import { congressOn } from "../../lib/congress.js";
import LinkedText from "../components/LinkedText.jsx";
import Portrait from "../components/Portrait.jsx";
import LeadershipLine from "../components/LeadershipLine.jsx";
import { noPhoto } from "../lib/photo.js";
import { Fold } from "../components/Fold.jsx";
import { memberPage } from "../lib/memberPage.js";
import { useEffect, useState, lazy, Suspense } from "react";
import { voteKind, isFinal } from "../lib/voteKind.js";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { db } from "../lib/db.js";
import { seatNextUp, nextElectionYear, servedInCongress } from "../../lib/congress.js";
import AtAGlance from "../components/AtAGlance.jsx";
import EmbedCode from "../components/EmbedCode.jsx";
import Scale from "../components/Scale.jsx";
import Follow from "../components/Follow.jsx";
import { KindLabel, Position, VoteMeaning } from "../components/Explain.jsx";
import { seatLabel, date, money, billLabel, ordinal, stateName, partyName } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { ballotYearFor, generalElectionDate } from "../../lib/upForElection.js";
import { NotesList, NotesProvider, Ref } from "../components/Notes.jsx";
import { PartyName } from "../components/PartyTag.jsx";
import { termPartyPeriods } from "../../lib/partyPeriods.js";
import { CandidateTable } from "./Elections.jsx";
import { useCaResults, ResultsStatus, RaceResult, PartyKey } from "../components/CaResults.jsx";
import { decodeEntities } from "../../lib/ptr.js";
import VoteResult from "../components/VoteResult.jsx";
import { PlainLead } from "../components/PlainSummary.jsx";
import { usePlainSummaries, voteBill } from "../lib/plainSummaries.js";
import SaveToggle from "../components/SaveToggle.jsx";

const BIOGUIDE = /^[A-Z][0-9]{6}$/;
const TERRITORIES = new Set(["DC", "PR", "GU", "VI", "AS", "MP"]);
const MIN_SPLIT_VOTES = 20; // below this, a rate says more about the sample than the member
const pct = (n, d) => (d ? `${(Math.round((1000 * n) / d) / 10).toFixed(1)}%` : "—");
const partyAdj = (p) => tr(p === "Democrat" ? "Democratic" : p, { Democrat: "demócrata", Republican: "republicana", Independent: "independiente" }[p] ?? p);
const chamberName = (c) => (c === "house" ? tr("House", "Cámara") : tr("Senate", "Senado"));

// One Congress and chamber of party-line and attendance figures, in plain sentences.
function VoteStats({ s, median, delegate, independent }) {
  const party = partyAdj(s.scoring_party);
  return (
    <div className="stat-block">
      <h3>{ordinal(s.congress)} {tr("Congress", "Congreso")}, {chamberName(s.chamber)}</h3>
      {s.party_split_votes < MIN_SPLIT_VOTES ? (
        <p>{tr(`Party-line rate: not calculated (${s.party_split_votes} party-split votes; at least ${MIN_SPLIT_VOTES} needed).`, `Tasa de voto con el partido: no calculada (${s.party_split_votes} votaciones divididas por partido; se necesitan al menos ${MIN_SPLIT_VOTES}).`)}</p>
      ) : (
        <p>
          {tr(`Voted with the ${party} majority on `, `Votó con la mayoría ${party} en el `)}<strong>{pct(s.with_party, s.party_split_votes)}</strong>{tr(" of party-split votes", " de las votaciones divididas por partido")}{" "}
          ({s.with_party.toLocaleString()} {tr("of", "de")} {s.party_split_votes.toLocaleString()})
          {independent && <>{tr(" — the party this member caucuses with", " — el partido con el que se agrupa este miembro")}</>}.
          {median && !delegate && <> {tr("Chamber median", "Mediana de la cámara")}: {pct(median.median_party_line_rate * 1000, 1000)}.</>}
        </p>
      )}
      {s.party_split_votes >= MIN_SPLIT_VOTES && (
        <Scale value={s.with_party / s.party_split_votes} typical={median && !delegate ? median.median_party_line_rate : null}
          label={tr(`with the ${party} majority`, `con la mayoría ${party}`)} typicalLabel={tr("chamber median", "mediana de la cámara")} />
      )}
      <p>
        {tr("Missed ", "No votó en el ")}<strong>{pct(s.missed, s.roll_calls)}</strong>{tr(" of roll-call votes", " de las votaciones nominales")} ({s.missed.toLocaleString()} {tr("of", "de")} {s.roll_calls.toLocaleString()}).
        {median && !delegate && <> {tr("Chamber median", "Mediana de la cámara")}: {pct(median.median_missed_rate * 1000, 1000)}.</>}
      </p>
      {s.roll_calls > 0 && <Scale value={s.missed / s.roll_calls} typical={median && !delegate ? median.median_missed_rate : null}
        label={tr("of roll calls missed", "de votaciones sin votar")} typicalLabel={tr("chamber median", "mediana de la cámara")} />}
    </div>
  );
}

const one = (q) => q.then(({ data, error }) => { if (error) throw error; return data; });

// What the top of the page needs (the summary, each section's one-line label, contact and time
// in office) comes in one request, from the database function member_page. The rest loads when
// its section is opened (SECTION_DATA), so a phone isn't waiting on records nobody has asked for.
async function loadMember(id) {
  return memberPage(id);
}

// The record in date order, loaded when its topic opens.
const MemberTimeline = lazy(() => import("../components/MemberTimeline.jsx"));
// Official general-election results, loaded (with their data files) when Time in office opens.
const ElectionResults = lazy(() => import("../components/ElectionResults.jsx"));

const SECTION_DATA = {
  votes: async (id) => ({
    // member_votes starts from the member's positions (indexed), so this stays fast.
    votes: await one(db.from("member_votes")
      .select("vote_id,chamber,question,result,voted_at,description,document_name,source_url,position,bill_congress,bill_type,bill_number,yea_total,nay_total,required,amendment_ref")
      .eq("bioguide_id", id).order("voted_at", { ascending: false }).limit(120))
      .then((rows) => rows.map((v) => ({ ...v, vote_positions: [{ position: v.position }] }))),
  }),
  bills: async (id) => {
    const [bills, sponsoredCount, cosponsoredCount, billMedians] = await Promise.all([
      one(db.from("bills").select("congress,bill_type,number,title,short_title,introduced_date,latest_action_date,latest_action_text,source_url,law_number")
        .eq("sponsor_bioguide_id", id).order("introduced_date", { ascending: false }).limit(10)),
      db.from("bills").select("*", { count: "exact", head: true }).eq("sponsor_bioguide_id", id).then((r) => r.count),
      db.from("bill_cosponsors").select("*", { count: "exact", head: true }).eq("bioguide_id", id).is("withdrawn_date", null).then((r) => r.count),
      one(db.from("chamber_bill_medians").select("*")),
    ]);
    return { bills, sponsoredCount, cosponsoredCount, billMedians };
  },
  money: async (id) => {
    const [byState, employers, pacs, outside] = await Promise.all([
      one(db.from("finance_by_state").select("cycle,state,total,contributions").eq("bioguide_id", id)),
      one(db.from("finance_top_employers").select("*").eq("bioguide_id", id).order("rank")),
      one(db.from("finance_committee_contributions").select("*").eq("bioguide_id", id).order("rank")),
      one(db.from("outside_spending").select("*").eq("bioguide_id", id).order("total", { ascending: false })),
    ]);
    return { byState, employers, pacs, outside };
  },
  trades: async (id) => {
    const [trades, filings] = await Promise.all([
      one(db.from("stock_trades_dedup").select("filing_id,row_num,owner,asset_name,ticker,transaction_type,transaction_date,amount_text,filed_date,days_to_file,is_amendment,source_url")
        .eq("bioguide_id", id).order("transaction_date", { ascending: false }).limit(25)),
      one(db.from("ptr_filings").select("filing_id,filed_date,format,source_url").eq("bioguide_id", id).eq("format", "scanned").order("filed_date", { ascending: false })),
    ]);
    return { trades, filings };
  },
};

const SIZE_LABEL = () => ({ 0: tr("$200 and under", "$200 o menos"), 200: "$200.01–$499", 500: "$500–$999", 1000: "$1,000–$1,999", 2000: tr("$2,000 and over", "$2,000 o más") });

// Where the money came from in one cycle: size of individual gifts, donors' employers, PACs,
// and outside groups' spending. All figures are FEC aggregates; no donor is named.
// Itemized individual contributions (over $200 in the cycle) split by the donor's state.
function ByStateShare({ home, rows }) {
  const total = rows.reduce((a, r) => a + Number(r.total ?? 0), 0);
  if (!(total > 0)) return null;
  const inState = rows.filter((r) => r.state === home).reduce((a, r) => a + Number(r.total ?? 0), 0);
  const pct = Math.round((100 * inState) / total);
  const top = [...rows].filter((r) => r.state !== home && /^[A-Z]{2}$/.test(r.state)).sort((a, z) => z.total - a.total).slice(0, 5);
  return (
    <>
      <h4>{tr("Where itemized donors live", "Dónde viven los donantes detallados")}</h4>
      <div className="share-bar" role="img" aria-label={tr(`${pct}% from ${stateName(home)}, ${100 - pct}% from elsewhere`, `${pct}% de ${stateName(home)}, ${100 - pct}% de otros lugares`)}>
        <span className="share-in" style={{ width: `${pct}%` }} />
      </div>
      <table>
        <tbody>
          <tr><td>{tr(`From ${stateName(home)}`, `De ${stateName(home)}`)}</td><td>{money(inState)}</td><td>{pct}%</td></tr>
          <tr><td>{tr("From other states and abroad", "De otros estados y del extranjero")}</td><td>{money(total - inState)}</td><td>{100 - pct}%</td></tr>
        </tbody>
      </table>
      {top.length > 0 && <p className="fine">{tr("Largest other states: ", "Otros estados con más: ")}{top.map((r) => `${stateName(r.state)} ${money(Number(r.total))}`).join(", ")}.</p>}
      <p className="fine">{tr("Only contributions from individuals that add up to more than $200 in the cycle are reported with an address. Smaller gifts aren't included here.", "Solo las contribuciones de personas que suman más de $200 en el ciclo se reportan con dirección. Las donaciones menores no se incluyen aquí.")}</p>
    </>
  );
}

// Committees (PACs, party and candidate committees) that gave the most to the campaign in one
// cycle. Rows with a source_date are net totals per giving committee from the FEC bulk file
// (scripts/ingest/fec-pas2.mjs); rows without one were written by the earlier method, which read
// only the 100 largest single contributions, and keep that method's wording until replaced.
function CommitteeGivers({ cycle, pacs }) {
  const rows = [...pacs].sort((a, z) => Number(z.total) - Number(a.total) || a.contributor_name.localeCompare(z.contributor_name));
  const asOf = rows.every((p) => p.source_date) ? rows.map((p) => p.source_date).sort().at(-1) : null;
  const shown = rows.slice(0, 10);
  const tied = rows.length > 10 ? rows.slice(10).filter((p) => Number(p.total) === Number(shown.at(-1).total)).length : 0;
  const name = (p) => /^C\d{8}$/.test(p.contributor_committee_id) ? <a href={`https://www.fec.gov/data/committee/${p.contributor_committee_id}/`}>{p.contributor_name}</a> : p.contributor_name;
  const bulk = <a href="https://www.fec.gov/campaign-finance-data/contributions-committees-candidates-file-description/">{tr("contributions from committees to candidates", "contribuciones de comités a candidatos")}</a>;
  if (!asOf) {
    return (
      <>
        <h4>{tr("Large contributions from PACs and other committees", "Contribuciones grandes de PAC y otros comités")}</h4>
        <p className="fine">{tr("Committees among the campaign's 100 largest single contributions from other committees, with what each gave in those contributions. Many committees give the same legal maximum, and one that gave in smaller amounts may not appear, so this is not a full ranking.", "Comités entre las 100 contribuciones individuales más grandes que la campaña recibió de otros comités, con lo que cada uno dio en esas contribuciones. Muchos comités dan el mismo máximo legal, y uno que dio montos menores puede no aparecer, así que no es una clasificación completa.")}</p>
        <ol className="plain">{shown.map((p) => <li key={`${p.fec_candidate_id}-${p.rank}`}>{name(p)} · {money(Number(p.total))}</li>)}</ol>
      </>
    );
  }
  return (
    <>
      <h4>{tr("PACs and other committees that gave the most", "PAC y otros comités que más dieron")}</h4>
      <p className="fine">
        {tr(`Net amounts each committee reported giving to the campaign's own committees in the ${cycle} cycle, from the FEC's file of `, `Montos netos que cada comité reportó haber dado a los comités de la propia campaña en el ciclo ${cycle}, del archivo de la FEC de `)}
        {bulk}{tr(` updated ${date(asOf)}. `, ` actualizado el ${date(asOf)}. `)}
        {tr("Includes in-kind gifts, less refunds the giving committee reported; outside spending is listed separately below.", "Incluye donaciones en especie, menos los reembolsos que reportó el comité donante; el gasto externo aparece aparte, más abajo.")}
      </p>
      <ol className="plain">{shown.map((p) => <li key={`${p.fec_candidate_id}-${p.rank}`}>{name(p)} · {money(Number(p.total))}</li>)}</ol>
      {tied > 0 && <p className="fine">{tr(`${tied} more ${tied === 1 ? "committee" : "committees"} also gave ${money(Number(shown.at(-1).total))}. Ties are listed alphabetically.`, `${tied} ${tied === 1 ? "comité más también dio" : "comités más también dieron"} ${money(Number(shown.at(-1).total))}. Los empates se listan en orden alfabético.`)}</p>}
    </>
  );
}

function FinanceDetail({ cycle, bySize, byState, home, employers, pacs, outside, fecId }) {
  const sizeTotal = bySize.reduce((a, r) => a + Number(r.total ?? 0), 0);
  const support = outside.filter((o) => o.support_oppose === "support");
  const oppose = outside.filter((o) => o.support_oppose === "oppose");
  const sum = (rows) => rows.reduce((a, r) => a + Number(r.total ?? 0), 0);
  return (
    <div className="finance-detail">
      <h3>{tr(`${cycle} cycle in detail`, `Ciclo ${cycle} en detalle`)}</h3>
      {bySize.length > 0 && (
        <>
          <h4>{tr("Individual contributions by size", "Contribuciones individuales por monto")}</h4>
          <table>
            <tbody>
              {[...bySize].sort((a, b) => a.size_bucket - b.size_bucket).map((r) => (
                <tr key={r.size_bucket}><td>{SIZE_LABEL()[r.size_bucket] ?? `$${r.size_bucket}+`}</td><td>{money(Number(r.total))}</td><td>{sizeTotal ? `${Math.round((100 * Number(r.total)) / sizeTotal)}%` : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {byState.length > 0 && home && <ByStateShare home={home} rows={byState} />}
      {employers.length > 0 && (
        <>
          <h4>{tr("Donors' employers", "Empleadores de los donantes")}</h4>
          <p className="fine">{tr("Contributions from individuals who listed these employers. Companies can't give directly to federal campaigns.", "Contribuciones de personas que indicaron estos empleadores. Las empresas no pueden donar directamente a campañas federales.")}</p>
          <ol className="plain">
            {employers.slice(0, 10).map((e) => <li key={e.rank}>{e.employer} · {money(Number(e.total))} {tr("from", "de")} {e.contributions?.toLocaleString() ?? "—"} {tr("contributions", "contribuciones")}</li>)}
          </ol>
        </>
      )}
      {pacs.length > 0 && <CommitteeGivers cycle={cycle} pacs={pacs} />}
      {outside.length > 0 && (
        <>
          <h4>{tr("Outside spending", "Gasto externo")}</h4>
          <p className="fine">{tr("Independent expenditures by groups not coordinating with the campaign.", "Gastos independientes de grupos que no coordinan con la campaña.")}</p>
          <p>{tr("Supporting", "A favor")}: <strong>{money(sum(support))}</strong> · {tr("Opposing", "En contra")}: <strong>{money(sum(oppose))}</strong></p>
          <ul className="plain">
            {outside.slice(0, 8).map((o) => <li key={`${o.committee_id}-${o.support_oppose}`}><a href={`https://www.fec.gov/data/committee/${o.committee_id}/`}>{o.committee_name}</a> · {o.support_oppose === "support" ? tr("supporting", "a favor") : tr("opposing", "en contra")} · {money(Number(o.total))}</li>)}
          </ul>
        </>
      )}
      {fecId && <p className="fine"><a href={`https://www.fec.gov/data/candidate/${fecId}/?cycle=${cycle}`}>{tr("Full records at FEC.gov", "Registros completos en FEC.gov (en inglés)")}</a></p>}
    </div>
  );
}

const SOCIAL = [
  ["social_x", "X", (h) => `https://x.com/${h}`],
  ["social_bluesky", "Bluesky", (h) => `https://bsky.app/profile/${h}`],
  ["social_facebook", "Facebook", (h) => `https://www.facebook.com/${h}`],
  ["social_instagram", "Instagram", (h) => `https://www.instagram.com/${h}`],
  ["social_youtube", "YouTube", (h) => (h.startsWith("UC") ? `https://www.youtube.com/channel/${h}` : `https://www.youtube.com/${h}`)],
];

// How to reach the member's Washington office, and their official accounts (links only).
function Contact({ term, member }) {
  const accounts = SOCIAL.filter(([k]) => member[k]);
  if (!term?.phone && !term?.contact_form && !term?.address && accounts.length === 0) return null;
  return (
    <section className="contact">
      {term.phone && <p>{tr("Washington office", "Oficina en Washington")}: <a href={`tel:+1-${term.phone}`}>{term.phone}</a></p>}
      {term.address && <p className="fine">{term.address}</p>}
      <p>
        {term.contact_form && <><a href={term.contact_form}>{tr("Email through the official contact form", "Escribir mediante el formulario oficial de contacto")}</a></>}
        {term.contact_form && term.url && " · "}
        {term.url && <a href={term.url}>{tr("Official website", "Sitio web oficial")}</a>}
      </p>
      {accounts.length > 0 && (
        <p className="fine">{tr("Official accounts", "Cuentas oficiales")}: {accounts.map(([k, label, link], i) => (
          <span key={k}>{i ? " · " : ""}<a href={link(member[k])} rel="noopener noreferrer">{label}</a></span>
        ))}</p>
      )}
      <p className="fine">{tr("Offices usually ask for your address to confirm you're a constituent.", "Las oficinas suelen pedir su dirección para confirmar que vive en su distrito o estado.")}<Ref id="src-contact" text={tr("Source: unitedstates/congress-legislators.", "Fuente: unitedstates/congress-legislators.")} /></p>
    </section>
  );
}

// The page shows a plain summary first, then one section per topic that opens in place. Each
// section's label carries a one-line summary of what's inside, so a reader can decide whether
// to open it. Contents render only when open (faster, and the notes list matches what's shown).
// #votes, #bills, #money and #trades open that section (old tab links keep working).
const FOLDS = ["record", "contact", "service", "committees", "votes", "bills", "money", "trades", "follow"];

// A section's source goes in the page's notes, cited from its heading.
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function Section({ title, source, children }) {
  return (
    <section className="section">
      <h3>{title}{source && <Ref id={`src-${slug(title)}`} text={<>{tr("Source", "Fuente")}: {source}</>} />}</h3>
      {children}
    </section>
  );
}

export default function Member() {
  const { bioguide } = useParams();
  const [state, setState] = useState({ status: "loading" });
  const [finalOnly, setFinalOnly] = useState(false);
  const [pickedCycle, setPickedCycle] = useState(null);
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => new Set());
  // Records for sections that have been opened: { votes: {...} | "loading" | "error", ... }
  const [more, setMore] = useState({});
  useEffect(() => { setMore({}); setOpen(new Set()); }, [bioguide]);
  useEffect(() => {
    if (state.status !== "done") return;
    for (const id of open) {
      if (!SECTION_DATA[id] || (more[id] && more[id] !== "error")) continue;
      setMore((m) => ({ ...m, [id]: "loading" }));
      SECTION_DATA[id](bioguide)
        .then((d) => setMore((m) => ({ ...m, [id]: d })))
        .catch(() => setMore((m) => ({ ...m, [id]: "error" })));
    }
  }, [open, state.status, bioguide]);
  const toggle = (id, isOpen) => setOpen((prev) => {
    if (prev.has(id) === isOpen) return prev;
    const next = new Set(prev);
    if (isOpen) next.add(id); else next.delete(id);
    return next;
  });
  // A link to #votes (etc.) opens that section and brings it into view once the page has loaded.
  const target = FOLDS.includes(hash.slice(1)) ? hash.slice(1) : null;
  useEffect(() => {
    if (!target || state.status !== "done") return;
    toggle(target, true);
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start" }));
  }, [target, state.status]);

  useEffect(() => {
    if (!BIOGUIDE.test(bioguide ?? "")) { setState({ status: "missing" }); return; }
    setState({ status: "loading" });
    loadMember(bioguide)
      .then((data) => setState(data.member ? { status: "done", data } : { status: "missing" }))
      .catch(() => setState({ status: "error" }));
  }, [bioguide]);

  useEffect(() => {
    const m = state.data?.member;
    if (m) document.title = `${m.official_full_name ?? `${m.first_name} ${m.last_name}`} · Civic Atlas`;
  }, [state.data]);
  // AI one-line summaries for the sponsored bills and the bills voted on, once those sections load.
  const plain = usePlainSummaries([...(more.bills?.bills ?? []), ...(more.votes?.votes ?? []).map(voteBill).filter(Boolean)]);
  if (state.status === "loading") return <main className="page"><p>{tr("Loading…", "Cargando…")}</p></main>;
  if (state.status === "missing") return <main className="page"><h1>{tr("Member not found", "Miembro no encontrado")}</h1><p><Link to="/">{tr("Back to search", "Volver a la búsqueda")}</Link></p></main>;
  if (state.status === "error") return <main className="page"><p className="notice">{tr("Couldn't load this page right now. Try again shortly.", "No se pudo cargar esta página. Inténtelo de nuevo en un momento.")}</p></main>;

  const loaded = Object.assign({}, ...Object.values(more).filter((v) => typeof v === "object"));
  const { member: m, terms, seat, memberships, votes = [], bills = [], sponsoredCount = 0, cosponsoredCount = 0, finance, freshness, voteStats: allVoteStats, medians, billStats, billMedians = [], trades = [], filings: scannedFilings = [], tradeSummary: ts, bySize, byState = [], employers = [], pacs = [], outside = [], laws, candidacies } = { ...state.data, ...loaded };
  // Only Congresses the member served in (see servedInCongress).
  const voteStats = allVoteStats.filter((s) => servedInCongress(terms, s.chamber, s.congress));
  const sectionStatus = (id) => (typeof more[id] === "string" ? more[id] : more[id] ? undefined : "loading");
  // Finance detail is shown for the most recent cycle with detail on file.
  // Cycles with detail on file, newest first; the visitor can switch between them.
  const detailCycles = [...new Set([...bySize, ...employers, ...pacs, ...outside].map((r) => r.cycle))].sort((a, z) => z - a);
  const detailCycle = detailCycles.includes(pickedCycle) ? pickedCycle : (detailCycles[0] ?? 0);
  const inCycle = (rows) => rows.filter((r) => r.cycle === detailCycle);
  const delegate = latest => latest?.chamber === "house" && TERRITORIES.has(latest.state);
  const name = m.official_full_name ?? `${m.first_name} ${m.last_name}`;
  const latest = terms[0];
  const currentCongress = Math.max(0, ...memberships.map((c) => c.congress));
  const committees = memberships.filter((c) => c.congress === currentCongress && c.committee);
  const fullCommittees = committees.filter((c) => !c.committee.parent_id);
  const subsByParent = (pid) => committees.filter((c) => c.committee.parent_id === pid);
  const fresh = Object.fromEntries(freshness.map((f) => [f.job, f.last_success_at]));
  const updated = (job) => (fresh[job] ? tr(` Updated ${date(fresh[job])}.`, ` Actualizado el ${date(fresh[job])}.`) : "");
  // The latest Congress's vote job (votes-120 from Jan 3, 2027; votes-119 and votes-118 stay in the log).
  const voteJob = Object.keys(fresh).filter((j) => /^votes-\d+$/.test(j)).sort().at(-1);

  // One-line summaries for each section's label: same wording for every member, from the records.
  const pctOf = (n, d) => `${Math.round((100 * n) / d)}%`;
  const vs = voteStats[0];
  const billCongress = billStats[0]?.congress;
  const introduced = billCongress ? billStats.filter((b) => b.congress === billCongress).reduce((n, b) => n + b.sponsored, 0) : 0;
  const enacted = billCongress ? laws.filter((l) => l.congress === billCongress).length : 0;
  const raised = finance.find((x) => Number(x.receipts) > 0);
  const firstYear = terms.length ? terms.reduce((a, t) => (t.start_date < a ? t.start_date : a), terms[0].start_date).slice(0, 4) : null;
  const upIn = seat?.seat_status === "serving" ? seatNextUp(seat.chamber, seat.senate_class) : null;
  const sum = {
    votes: vs && vs.roll_calls > 0
      ? tr(`Voted on ${pctOf(vs.roll_calls - vs.missed, vs.roll_calls)} of roll calls in the ${ordinal(vs.congress)} Congress`, `Votó en el ${pctOf(vs.roll_calls - vs.missed, vs.roll_calls)} de las votaciones nominales del ${ordinal(vs.congress)} Congreso`)
      : tr("No roll-call votes on record since 2023", "No hay votaciones nominales registradas desde 2023"),
    bills: billCongress
      ? tr(`Introduced ${introduced.toLocaleString()} in the ${ordinal(billCongress)} Congress; ${enacted.toLocaleString()} became law`, `Presentó ${introduced.toLocaleString()} en el ${ordinal(billCongress)} Congreso; ${enacted.toLocaleString()} se convirtieron en ley`)
      : tr("No bills on record since 2023", "No hay proyectos registrados desde 2023"),
    committees: fullCommittees.length
      ? tr(`Serves on ${fullCommittees.length} committee${fullCommittees.length === 1 ? "" : "s"}`, `Forma parte de ${fullCommittees.length} comité${fullCommittees.length === 1 ? "" : "s"}`)
      : tr("No committee assignments on record", "No hay asignaciones a comités registradas"),
    money: raised
      ? tr(`Raised ${money(Number(raised.receipts))} in the ${raised.cycle - 1}–${raised.cycle} election cycle`, `Recaudó ${money(Number(raised.receipts))} en el ciclo electoral ${raised.cycle - 1}–${raised.cycle}`)
      : tr("No FEC filings on record", "No hay declaraciones ante la FEC registradas"),
    trades: ts
      ? tr(`${ts.trades.toLocaleString()} transaction${ts.trades === 1 ? "" : "s"} reported since 2025`, `${ts.trades.toLocaleString()} transacci${ts.trades === 1 ? "ón informada" : "ones informadas"} desde 2025`)
      : tr("No reports on file since 2025", "No hay informes desde 2025"),
    service: [firstYear && tr(`In Congress since ${firstYear}`, `En el Congreso desde ${firstYear}`), upIn && tr(`seat next up for election in ${upIn}`, `escaño en elección en ${upIn}`)].filter(Boolean).join(tr("; ", "; ")),
  };

  return (
    <NotesProvider>
    <main className="page full">
      <header className="page-head member-head">
        <Portrait className="member-photo" party={seat?.party ?? m.party} src={`https://unitedstates.github.io/images/congress/225x275/${m.bioguide_id}.jpg`} alt={name} width="90" height="110" fetchpriority="high" />
        <h1>{name}</h1>
        {seat?.seat_status === "serving" ? (
          <><p className="lede">{seatLabel(seat)}</p>
          <LeadershipLine bioguideId={m.bioguide_id} />
          <p className="member-meta">{tr("Current term", "Período actual")} {date(seat.start_date)} – {date(seat.end_date)}</p>
          <BallotLine seat={seat} />
          <RaceFilers seat={seat} upIn={upIn} mode="line" /></>
        ) : seat?.seat_status === "pending_update" ? (
          // The term ended (Jan 3 for a Congress) and the member list doesn't have the seat's next
          // term yet: don't say whether this member is serving, either way.
          <><p className="lede">{seatLabel(seat)}</p>
          <p className="member-meta">{tr(`Term ${date(seat.start_date)} – ${date(seat.end_date)}. A new term for this seat began on ${date(seat.end_date)}; information is being updated.`,
            `Período ${date(seat.start_date)} – ${date(seat.end_date)}. Un nuevo período para este escaño comenzó el ${date(seat.end_date)}; la información se está actualizando.`)}</p></>
        ) : (
          <p className="lede">{tr("Not currently serving. Most recent", "No está en el cargo. Último cargo")}: {seatLabel(latest)}, {date(latest.start_date)} – {date(latest.end_date)} <PartyName party={latest.party} /></p>
        )}
        <SaveToggle official={m.bioguide_id} />
      </header>

      <AtAGlance terms={terms} voteStats={voteStats} medians={medians} billStats={billStats} laws={laws}
        finance={finance} bySize={bySize} tradeSummary={ts} delegate={delegate(latest)} />

      <p className="fold-hint">{tr("Tap a topic to see the details and records.", "Toque un tema para ver los detalles y registros.")}</p>
      <div className="folds">
      <Fold id="record" title={tr("Record by date", "Historial por fecha")} open={open.has("record")} onToggle={toggle}
        summary={tr("Votes, bills introduced, bills that became law and reported stock trades, newest first", "Votos, proyectos presentados, proyectos que se convirtieron en ley y operaciones bursátiles declaradas, del más reciente al más antiguo")}>
        <Suspense fallback={<p>{tr("Loading…", "Cargando…")}</p>}><MemberTimeline bioguide={bioguide} /></Suspense>
      </Fold>
      {seat?.seat_status === "serving" && (
        <Fold id="contact" title={tr("Contact", "Contacto")} open={open.has("contact")} onToggle={toggle}
          summary={terms[0]?.phone ? tr(`Washington office: ${terms[0].phone}`, `Oficina en Washington: ${terms[0].phone}`) : tr("Office, email form and website", "Oficina, formulario de correo y sitio web")}>
          <Contact term={terms[0]} member={m} />
        </Fold>
      )}
      <Fold id="votes" title={tr("Votes", "Votos")} open={open.has("votes")} onToggle={toggle} status={sectionStatus("votes")} summary={sum.votes}>

      <Section title={tr("Voting record", "Historial de votos")} source={<>{tr("Calculated from House Clerk and Senate.gov roll-call records.", "Calculado a partir de los registros de votaciones nominales del Secretario de la Cámara y de Senate.gov.")} <Link to="/methods">{tr("How these are calculated", "Cómo se calculan")}</Link>.</>}>
        {voteStats.length === 0 ? <p>{tr("No roll-call votes on record since 2023.", "No hay votaciones nominales registradas desde 2023.")}</p> : (
          <>
            {delegate(latest) && (
              <p className="notice">
                {tr("Delegates and the Resident Commissioner can vote only on certain amendment votes, so these figures cover far fewer roll calls than a member's and aren't compared with the chamber.",
                  "Los delegados y el Comisionado Residente solo pueden votar en ciertas votaciones de enmiendas, así que estas cifras abarcan muchas menos votaciones que las de un miembro y no se comparan con la cámara.")}
              </p>
            )}
            {voteStats.map((s) => (
              <VoteStats key={`${s.congress}-${s.chamber}`} s={s}
                median={medians.find((x) => x.congress === s.congress && x.chamber === s.chamber)}
                delegate={delegate(latest)}
                independent={terms.some((t) => t.party === "Independent")} />
            ))}
          </>
        )}
      </Section>

      <Section title={tr("Recent roll-call votes", "Votaciones nominales recientes")} source={<>{tr("House Clerk and Senate.gov roll-call records; positions as recorded.", "Registros de votaciones del Secretario de la Cámara y de Senate.gov; votos tal como se registraron (Yea = sí, Nay = no).")}{voteJob ? updated(voteJob) : ""} <Link to="/methods#vote-types">{tr("About vote types", "Sobre los tipos de votación")}</Link>.</>}>
        {votes.length === 0 ? <p>{tr("No roll-call votes on record since 2023.", "No hay votaciones nominales registradas desde 2023.")}</p> : (
          <>
          <div className="toggle" role="group" aria-label={tr("Which votes to show", "Qué votos mostrar")}>
            <button type="button" aria-pressed={!finalOnly} className={finalOnly ? "" : "on"} onClick={() => setFinalOnly(false)}>{tr("All votes", "Todos los votos")}</button>
            <button type="button" aria-pressed={finalOnly} className={finalOnly ? "on" : ""} onClick={() => setFinalOnly(true)}>{tr("Final votes only", "Solo votos finales")}</button>
          </div>
          <table className="vote-table">
            <thead><tr><th>{tr("Date", "Fecha")}</th><th>{tr("Question", "Asunto")}</th><th>{tr("Vote", "Voto")}</th><th>{tr("Result", "Resultado")}</th></tr></thead>
            <tbody>
              {votes.filter((v) => !finalOnly || isFinal(v)).slice(0, 15).map((v) => (
                <tr key={v.vote_id}>
                  <td className="vt-date">{date(v.voted_at)}</td>
                  <td className="vt-q">
                    <VoteMeaning v={v} />
                    <KindLabel v={v} />
                    <a href={v.source_url}>{v.question}</a>
                    {(v.document_name || v.description) && <div className="fine"><LinkedText text={[v.document_name, v.description].filter(Boolean).join(" · ")} congress={congressOn(new Date(v.voted_at))} /></div>}
                    <PlainLead map={plain} bill={voteBill(v)} />
                  </td>
                  <td data-label={tr("Vote:", "Voto:")}><Position v={v} position={v.vote_positions[0]?.position} /></td>
                  <td data-label={tr("Result:", "Resultado:")}><VoteResult v={v} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {finalOnly && votes.filter(isFinal).length === 0 && <p className="fine">{tr("No final votes among the most recent 120 roll calls.", "No hay votos finales entre las 120 votaciones más recientes.")}</p>}
          <p><Link to={`/member/${m.bioguide_id}/votes`}>{tr("All votes, searchable by issue →", "Todos los votos, con búsqueda por tema (en inglés) →")}</Link></p>
          </>
        )}
      </Section>

      </Fold>
      <Fold id="bills" title={tr("Bills", "Proyectos de ley")} open={open.has("bills")} onToggle={toggle} status={sectionStatus("bills")} summary={sum.bills}>

      <Section title={tr("Legislation", "Legislación")} source={tr(`GovInfo Bill Status (Library of Congress), 118th Congress on.${updated("bills")}`, `GovInfo Bill Status (Biblioteca del Congreso), desde el 118.º Congreso.${updated("bills")}`)}>
        <p>{tr("Sponsored", "Patrocinados")}: {sponsoredCount ?? 0} · {tr("Cosponsored", "Copatrocinados")}: {cosponsoredCount ?? 0}</p>
        {billStats.map((b) => {
          const med = billMedians.find((x) => x.congress === b.congress && x.chamber === b.chamber);
          return (
            <div className="stat-block" key={`${b.congress}-${b.chamber}`}>
              <h3>{ordinal(b.congress)} {tr("Congress", "Congreso")}, {chamberName(b.chamber)}</h3>
              {b.cosponsored >= 20 ? (
                <p>
                  {tr(`Of the ${b.cosponsored.toLocaleString()} bills they cosponsored, `, `De los ${b.cosponsored.toLocaleString()} proyectos que copatrocinó, el `)}<strong>{pct(b.cosponsored_other_party, b.cosponsored)}</strong>{tr(" were introduced by a member of the other party.", " fue presentado por un miembro del otro partido.")}
                  {med?.median_cross_party_cosponsor_rate != null && <> {tr("Chamber median", "Mediana de la cámara")}: {pct(med.median_cross_party_cosponsor_rate * 1000, 1000)}.</>}
                </p>
              ) : <p>{tr(`Cosponsored ${b.cosponsored} bills (too few to calculate a cross-party rate).`, `Copatrocinó ${b.cosponsored} proyectos (muy pocos para calcular una tasa entre partidos).`)}</p>}
              {b.sponsored >= 10 ? (
                <p>
                  {tr(`Of the ${b.sponsored.toLocaleString()} bills they introduced, `, `De los ${b.sponsored.toLocaleString()} proyectos que presentó, el `)}<strong>{pct(b.sponsored_with_other_party, b.sponsored)}</strong>{tr(" had at least one cosponsor from the other party.", " tuvo al menos un copatrocinador del otro partido.")}
                  {med?.median_cross_party_support_rate != null && <> {tr("Chamber median", "Mediana de la cámara")}: {pct(med.median_cross_party_support_rate * 1000, 1000)}.</>}
                </p>
              ) : b.sponsored > 0 && <p>{tr(`Introduced ${b.sponsored} bills (too few to calculate a cross-party rate).`, `Presentó ${b.sponsored} proyectos (muy pocos para calcular una tasa entre partidos).`)}</p>}
            </div>
          );
        })}
        <p className="fine"><Link to="/methods#cosponsorship">{tr("How these are calculated", "Cómo se calculan")}</Link>.</p>
        {bills.length > 0 && (
          <ul className="plain">
            {bills.map((b) => (
              <li key={`${b.congress}-${b.bill_type}-${b.number}`}>
                <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link> ({ordinal(b.congress)}) · {b.short_title ?? b.title}{b.law_number && <> · <strong>{b.law_number}</strong></>}
                <PlainLead map={plain} bill={b} />
                <div className="fine">{tr("Introduced", "Presentado el")} {date(b.introduced_date)}{b.latest_action_text && <> · {tr("Latest action", "Última acción")} {date(b.latest_action_date)}: {b.latest_action_text}</>}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      </Fold>
      <Fold id="committees" title={tr("Committees", "Comités")} open={open.has("committees")} onToggle={toggle} summary={sum.committees}>
      <Section title={currentCongress ? tr(`Committees (${ordinal(currentCongress)} Congress)`, `Comités (${ordinal(currentCongress)} Congreso)`) : tr("Committees", "Comités")} source={`unitedstates/congress-legislators.${updated("committees")}`}>
        {fullCommittees.length === 0 ? <p>{tr("No committee assignments on record.", "No hay asignaciones a comités registradas.")}</p> : (
          <ul className="plain">
            {fullCommittees.map((c) => (
              <li key={c.committee.committee_id}>
                <Link to={`/committee/${c.committee.committee_id}`}>{c.committee.name}</Link>
                {c.title && <> · {c.title}</>}
                {subsByParent(c.committee.committee_id).length > 0 && (
                  <ul>{subsByParent(c.committee.committee_id).map((s) => (
                    <li key={s.committee.committee_id}><Link to={`/committee/${s.committee.committee_id}`}>{s.committee.name.replace(/^the /, "The ")}</Link>{s.title && <> · {s.title}</>}</li>
                  ))}</ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      </Fold>
      <Fold id="money" title={tr("Campaign money", "Dinero de campaña")} open={open.has("money")} onToggle={toggle} status={sectionStatus("money")} summary={sum.money}>

      <Section title={tr("Campaign finance", "Finanzas de campaña")} source={<>{tr("Federal Election Commission (OpenFEC).", "Comisión Federal de Elecciones (OpenFEC).")}{updated("fec-summaries")} <Link to="/methods#money">{tr("About this data", "Sobre estos datos")}</Link>.</>}>
        {finance.length === 0 ? <p>{tr("No FEC filings on record for this member.", "No hay declaraciones ante la FEC registradas para este miembro.")}</p> : (
          <table>
            <thead><tr><th>{tr("Cycle", "Ciclo")}</th><th>{tr("Raised", "Recaudado")}</th><th>{tr("Spent", "Gastado")}</th><th>{tr("Cash on hand", "Efectivo disponible")}</th><th>{tr("Individuals", "Personas")}</th><th>PAC</th><th>{tr("Through", "Hasta")}</th></tr></thead>
            <tbody>
              {finance.map((f) => (
                <tr key={`${f.fec_candidate_id}-${f.cycle}`}>
                  <td><a href={f.source_url}>{f.cycle}</a></td>
                  <td>{money(f.receipts)}</td>
                  <td>{money(f.disbursements)}</td>
                  <td>{money(f.cash_on_hand)}</td>
                  <td>{money(f.individual_contributions)}</td>
                  <td>{money(f.pac_contributions)}</td>
                  <td>{date(f.coverage_end_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {detailCycles.length > 1 && (
          <div className="toggle" role="group" aria-label={tr("Election cycle to show in detail", "Ciclo electoral a mostrar en detalle")}>
            {detailCycles.map((c) => <button key={c} type="button" aria-pressed={c === detailCycle} className={c === detailCycle ? "on" : ""} onClick={() => setPickedCycle(c)}>{tr(`${c} cycle`, `Ciclo ${c}`)}</button>)}
          </div>
        )}
        {detailCycle > 0 && <FinanceDetail cycle={detailCycle} bySize={inCycle(bySize)} byState={inCycle(byState)} home={latest?.state} employers={inCycle(employers)} pacs={inCycle(pacs)} outside={inCycle(outside)} fecId={finance.find((f) => f.cycle === detailCycle)?.fec_candidate_id} />}
      </Section>
      </Fold>
      <Fold id="trades" title={tr("Stock trades", "Compraventa de acciones")} open={open.has("trades")} onToggle={toggle} status={sectionStatus("trades")} summary={sum.trades}>

      <Section title={tr("Stock trades", "Compraventa de acciones")} source={<>{tr("Periodic Transaction Reports filed under the STOCK Act with the House Clerk and Senate, 2025 on.", "Informes periódicos de transacciones presentados según la Ley STOCK ante el Secretario de la Cámara y el Senado, desde 2025.")}{updated("trades")} <Link to="/methods#trades">{tr("About this data", "Sobre estos datos")}</Link>.</>}>
        {!ts ? <p>{tr("No periodic transaction reports on record since 2025.", "No hay informes periódicos de transacciones registrados desde 2025.")}</p> : (
          <>
            <p>
              {tr(`${ts.filings} report${ts.filings === 1 ? "" : "s"} filed, listing ${ts.trades.toLocaleString()} transaction${ts.trades === 1 ? "" : "s"}.`, `${ts.filings} informe${ts.filings === 1 ? "" : "s"} presentado${ts.filings === 1 ? "" : "s"}, con ${ts.trades.toLocaleString()} transacci${ts.trades === 1 ? "ón" : "ones"}.`)}
              {ts.trades_with_dates > 0 && <> {tr("Reported more than 45 days after the transaction", "Informadas más de 45 días después de la transacción")}: <strong>{ts.reported_after_45_days.toLocaleString()}</strong> {tr("of", "de")} {ts.trades_with_dates.toLocaleString()}.</>}
            </p>
            {scannedFilings.length > 0 && (
              <p className="fine">
                {tr(`${scannedFilings.length} report${scannedFilings.length === 1 ? " was" : "s were"} filed on paper and ${scannedFilings.length === 1 ? "is" : "are"} linked but not itemized`, `${scannedFilings.length} informe${scannedFilings.length === 1 ? " se presentó" : "s se presentaron"} en papel; se enlaza${scannedFilings.length === 1 ? "" : "n"} pero no se detalla${scannedFilings.length === 1 ? "" : "n"}`)}: {scannedFilings.map((f, i) => <span key={f.filing_id}>{i ? ", " : ""}<a href={f.source_url}>{date(f.filed_date)}</a></span>)}.
              </p>
            )}
            {trades.length > 0 && (
              <table>
                <thead><tr><th>{tr("Traded", "Fecha")}</th><th>{tr("Asset", "Activo")}</th><th>{tr("Type", "Tipo")}</th><th>{tr("Amount", "Monto")}</th><th>{tr("Owner", "Titular")}</th><th>{tr("Reported", "Informado")}</th></tr></thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={`${t.filing_id}-${t.row_num}`}>
                      <td>{date(t.transaction_date)}</td>
                      <td>{t.ticker ? <><strong>{t.ticker}</strong> · </> : null}{decodeEntities(t.asset_name).replace(/\s+/g, " ")}</td>
                      <td>{t.transaction_type}</td>
                      <td>{t.amount_text}</td>
                      <td>{t.owner}</td>
                      <td>
                        <a href={t.source_url}>{date(t.filed_date)}</a>
                        {t.is_amendment && <div className="fine">{tr("in an amended report", "en un informe enmendado")}</div>}
                        {!t.is_amendment && t.days_to_file != null && t.days_to_file >= 0 && <div className={t.days_to_file > 45 ? "fine late" : "fine"}>{t.days_to_file} {tr("days", "días")}{t.days_to_file > 45 ? tr(" (over 45)", " (más de 45)") : ""}</div>}
                        {t.days_to_file != null && t.days_to_file < 0 && <div className="fine">{tr("Trade date as filed is after the report date", "La fecha de la transacción, tal como se presentó, es posterior a la del informe")}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {ts.trades > trades.length && <p className="fine">{tr(`Showing the ${trades.length} most recent of ${ts.trades.toLocaleString()}. Each links to its report.`, `Se muestran las ${trades.length} más recientes de ${ts.trades.toLocaleString()}. Cada una enlaza a su informe.`)}</p>}
          </>
        )}
      </Section>

      </Fold>
      <Fold id="service" title={tr("Time in office", "Tiempo en el cargo")} open={open.has("service")} onToggle={toggle} summary={sum.service}>
      <Section title={tr("Service in Congress", "Servicio en el Congreso")} source={<>unitedstates/congress-legislators.{updated("members")} {tr("Biography", "Biografía")}: <a href={m.source_url}>Biographical Directory of the U.S. Congress</a>.</>}>
        {seat?.seat_status === "serving" && (() => {
          const upIn = seatNextUp(seat.chamber, seat.senate_class);
          const filed = candidacies.find((c) => c.election_year === upIn);
          return upIn && (
            <p>
              {tr(`This seat is next up for election in ${upIn}.`, `Este escaño se elige de nuevo en ${upIn}.`)}
              {upIn === nextElectionYear() && (filed
                ? <> {tr(`Has filed with the FEC to run in ${upIn}`, `Se inscribió ante la FEC para postularse en ${upIn}`)}{filed.office === "S" ? tr(" for the Senate", " al Senado") : tr(` for the House${filed.district ? `, District ${filed.district}` : ""}`, ` a la Cámara${filed.district ? `, distrito ${filed.district}` : ""}`)} (<a href={`https://www.fec.gov/data/candidate/${filed.fec_candidate_id}/`}>FEC</a>).</>
                : <> {tr(`Hasn't filed with the FEC for ${upIn} yet.`, `Todavía no se ha inscrito ante la FEC para ${upIn}.`)}</>)}
            </p>
          );
        })()}
        {seat?.seat_status === "serving" && <RaceFilers seat={seat} upIn={upIn} mode="table" />}
        {terms.some((t) => t.chamber === "house" && t.state === "CA") && <CaHouseResult bioguide={m.bioguide_id} />}
        <ul className="plain">
          {terms.map((t) => (
            <li key={`${t.chamber}-${t.start_date}`}><TermLine t={t} /></li>
          ))}
        </ul>
      </Section>
      <Section title={tr("Election results", "Resultados electorales")} source={<>{tr("Certified results compiled by the FEC (Federal Elections) and, for years the FEC hasn't published yet, the House Clerk's election statistics.", "Resultados certificados recopilados por la FEC (Federal Elections) y, para los años que la FEC aún no ha publicado, las estadísticas electorales de la Secretaría de la Cámara.")} <Link to="/methods#election-results">{tr("How", "Cómo")}</Link></>}>
        <Suspense fallback={<p>{tr("Loading…", "Cargando…")}</p>}>
          <ElectionResults fecIds={m.fec_candidate_ids} />
        </Suspense>
      </Section>


      </Fold>
      <Fold id="follow" title={tr("Follow and share", "Seguir y compartir")} open={open.has("follow")} onToggle={toggle}
        summary={tr("News feed, calendar of their committees' hearings, and a box for your own site", "Noticias, calendario de audiencias de sus comités y un recuadro para su sitio")}>
      <Follow feed={`/api/feed/member/${m.bioguide_id}`} calendar={`/api/calendar/member/${m.bioguide_id}`}
        calendarLabel={tr("Add their committees' hearings to your calendar", "Agregar a su calendario las audiencias de sus comités")} />
      <EmbedCode path={`/embed/member/${m.bioguide_id}`} title={`${name} · Civic Atlas`} />

      </Fold>
      </div>
      <NotesList />
    </main>
    </NotesProvider>
  );
}

// One term: seat, party, dates. When the member changed party during the term (the source lists
// each stretch), every stretch is given with its dates, the last one "from" its start: "Democrat,
// Jan 3, 2019 – May 31, 2024; Independent from May 31, 2024". Same wording for every member.
function TermLine({ t }) {
  const periods = termPartyPeriods(t);
  if (periods.length === 1) return <>{seatLabel(t)} <PartyName party={periods[0].party} /> · {date(t.start_date)} – {date(t.end_date)}</>;
  return (
    <>{seatLabel(t)} · {date(t.start_date)} – {date(t.end_date)} · {periods.map((p, i) => (
      <span key={p.start_date}>{i ? "; " : ""}<PartyName party={p.party} />
        {i === periods.length - 1
          ? tr(` from ${date(p.start_date)}`, ` desde el ${date(p.start_date)}`)
          : `, ${date(p.start_date)} – ${date(p.end_date)}`}</span>
    ))}</>
  );
}

// The 2026 California House race this member's name is printed in, from the Secretary of State. Linked
// by the name as printed, never by district number: California used new congressional maps in 2026.
function CaHouseResult({ bioguide }) {
  const data = useCaResults();
  const race = data && data.house.find((r) => r.candidates.some((c) => c.bioguide_id === bioguide));
  if (!race) return null;
  return (
    <div id="ca-2026-result">
      <h3>{tr(`November 3, 2026 general election: California District ${race.district} (new map)`, `Elección general del 3 de noviembre de 2026: distrito ${race.district} de California (mapa nuevo)`)}</h3>
      <RaceResult race={race} />
      <ResultsStatus data={data} race={race} />
      <PartyKey />
    </div>
  );
}

// When this seat is next on the ballot (or was, if that election has passed and the term hasn't ended).
function BallotLine({ seat }) {
  const year = ballotYearFor(seat);
  if (!year) return null;
  const day = generalElectionDate(year);
  const held = day < new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  return (
    <p className="fine">
      {held ? tr(`This seat was on the ballot on ${date(day)}.`, `Este escaño estuvo en la boleta el ${date(day)}.`)
        : tr(`This seat is next on the ballot on ${date(day)}.`, `Este escaño estará en la boleta el ${date(day)}.`)}{" "}
      <Link to={`/on-the-ballot?year=${year}`}>{tr(`Everything on the ${year} ballot`, `Todo lo que está en la boleta de ${year}`)}</Link>
    </p>
  );
}

// Everyone who has filed with the FEC to run for this member's seat in the next election, the member
// included if they filed. "line" is a one-line count under the header; "table" is the list in the
// Time in office section. Shown only once the seat's next race is the coming election.
function RaceFilers({ seat, upIn, mode }) {
  const [list, setList] = useState(null);
  const active = upIn && upIn === nextElectionYear();
  useEffect(() => {
    if (!active) return;
    let q = db.from("candidates").select("*").eq("election_year", upIn).eq("office", seat.chamber === "senate" ? "S" : "H").eq("state", seat.state);
    if (seat.chamber === "house") q = q.eq("district", seat.district);
    q.order("name").then(({ data }) => setList(data ?? []));
  }, [active, upIn, seat.chamber, seat.state, seat.district]);
  if (!active || !list) return null;
  const others = list.filter((c) => c.bioguide_id !== seat.bioguide_id).length;
  const self = list.some((c) => c.bioguide_id === seat.bioguide_id);
  if (mode === "line") {
    return (
      <p className="fine">
        {others === 0
          ? tr(`No one else has filed with the FEC for this seat in ${upIn} yet.`, `Nadie más se ha inscrito ante la FEC para este escaño en ${upIn} todavía.`)
          : tr(`${others} other ${others === 1 ? "person has" : "people have"} filed with the FEC to run for this seat in ${upIn}.`, `${others} ${others === 1 ? "persona más se ha inscrito" : "personas más se han inscrito"} ante la FEC para postularse a este escaño en ${upIn}.`)}{" "}
        {list.length > 0 && <Link to="#service">{tr("See who", "Ver quiénes")}</Link>}
      </p>
    );
  }
  return (
    <div id="race-filers">
      <h3>{tr(`Filed with the FEC for this seat in ${upIn}`, `Inscritos ante la FEC para este escaño en ${upIn}`)}</h3>
      {list.length === 0 ? <p>{tr("No one has filed yet.", "Nadie se ha inscrito todavía.")}</p> : <CandidateTable list={list} />}
      <p className="fine">
        {tr(`Anyone can file, and filing doesn't mean a campaign is active. ${self ? "" : "This member hasn't filed for the seat. "}Party is shown as filed.`, `Cualquiera puede inscribirse, y la inscripción no significa que haya una campaña activa. ${self ? "" : "Este miembro no se ha inscrito para el escaño. "}El partido aparece según la inscripción.`)}{" "}
        <Link to={`/elections?state=${seat.state}`}>{tr(`All races in ${stateName(seat.state)}`, `Todas las contiendas en ${stateName(seat.state)}`)}</Link>
      </p>
    </div>
  );
}
