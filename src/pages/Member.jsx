import { useEffect, useState } from "react";
import { voteKind, isFinal } from "../lib/voteKind.js";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { db } from "../lib/db.js";
import { seatNextUp, nextElectionYear } from "../../lib/congress.js";
import AtAGlance from "../components/AtAGlance.jsx";
import EmbedCode from "../components/EmbedCode.jsx";
import Scale from "../components/Scale.jsx";
import Follow from "../components/Follow.jsx";
import { KindLabel, Position } from "../components/Explain.jsx";
import { seatLabel, date, money, billLabel, ordinal, stateName, partyName } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { PartyName } from "../components/PartyTag.jsx";

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

async function loadMember(id) {
  const one = (q) => q.then(({ data, error }) => { if (error) throw error; return data; });
  const [member, terms, seat, memberships, votes, bills, sponsoredCount, cosponsoredCount, finance, freshness, voteStats, medians, billStats, billMedians, trades, filings, tradeSummary, bySize, employers, pacs, outside, laws, candidacies] = await Promise.all([
    one(db.from("members").select("*").eq("bioguide_id", id).maybeSingle()),
    one(db.from("terms").select("chamber,state,district,party,start_date,end_date,phone,address,contact_form,url").eq("bioguide_id", id).order("start_date", { ascending: false })),
    one(db.from("seat_holders").select("*").eq("bioguide_id", id).maybeSingle()),
    one(db.from("committee_memberships").select("congress,title,side,rank,committee:committees(committee_id,name,parent_id,url)").eq("bioguide_id", id)),
    // member_votes starts from the member's positions (indexed), so this stays fast.
    one(db.from("member_votes")
      .select("vote_id,chamber,question,result,voted_at,description,document_name,source_url,position")
      .eq("bioguide_id", id).order("voted_at", { ascending: false }).limit(120))
      .then((rows) => rows.map((v) => ({ ...v, vote_positions: [{ position: v.position }] }))),
    one(db.from("bills").select("congress,bill_type,number,title,short_title,introduced_date,latest_action_date,latest_action_text,source_url,law_number")
      .eq("sponsor_bioguide_id", id).order("introduced_date", { ascending: false }).limit(10)),
    db.from("bills").select("*", { count: "exact", head: true }).eq("sponsor_bioguide_id", id).then((r) => r.count),
    db.from("bill_cosponsors").select("*", { count: "exact", head: true }).eq("bioguide_id", id).is("withdrawn_date", null).then((r) => r.count),
    one(db.from("finance_summaries").select("*").eq("bioguide_id", id).order("cycle", { ascending: false })),
    one(db.from("data_freshness").select("*")),
    one(db.from("member_vote_stats").select("*").eq("bioguide_id", id).order("congress", { ascending: false })),
    one(db.from("chamber_vote_medians").select("*")),
    one(db.from("member_bill_stats").select("*").eq("bioguide_id", id).order("congress", { ascending: false })),
    one(db.from("chamber_bill_medians").select("*")),
    one(db.from("stock_trades_dedup").select("filing_id,row_num,owner,asset_name,ticker,transaction_type,transaction_date,amount_text,filed_date,days_to_file,is_amendment,source_url")
      .eq("bioguide_id", id).order("transaction_date", { ascending: false }).limit(25)),
    one(db.from("ptr_filings").select("filing_id,filed_date,format,source_url").eq("bioguide_id", id).eq("format", "scanned").order("filed_date", { ascending: false })),
    one(db.from("member_trade_summary").select("*").eq("bioguide_id", id).maybeSingle()),
    one(db.from("finance_by_size").select("*").eq("bioguide_id", id)),
    one(db.from("finance_top_employers").select("*").eq("bioguide_id", id).order("rank")),
    one(db.from("finance_committee_contributions").select("*").eq("bioguide_id", id).order("rank")),
    one(db.from("outside_spending").select("*").eq("bioguide_id", id).order("total", { ascending: false })),
    one(db.from("bills").select("congress,bill_type,number").eq("sponsor_bioguide_id", id).not("became_law_date", "is", null)),
    one(db.from("candidates").select("fec_candidate_id,election_year,office,state,district").eq("bioguide_id", id)),
  ]);
  return { member, terms, seat, memberships, votes, bills, sponsoredCount, cosponsoredCount, finance, freshness, voteStats, medians, billStats, billMedians, trades, filings, tradeSummary, bySize, employers, pacs, outside, laws, candidacies };
}

const SIZE_LABEL = () => ({ 0: tr("Under $200", "Menos de $200"), 200: "$200–$499", 500: "$500–$999", 1000: "$1,000–$1,999", 2000: tr("$2,000 and over", "$2,000 o más") });

// Where the money came from in one cycle: size of individual gifts, donors' employers, PACs,
// and outside groups' spending. All figures are FEC aggregates; no donor is named.
function FinanceDetail({ cycle, bySize, employers, pacs, outside, fecId }) {
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
      {employers.length > 0 && (
        <>
          <h4>{tr("Donors' employers", "Empleadores de los donantes")}</h4>
          <p className="fine">{tr("Contributions from individuals who listed these employers. Companies can't give directly to federal campaigns.", "Contribuciones de personas que indicaron estos empleadores. Las empresas no pueden donar directamente a campañas federales.")}</p>
          <ol className="plain">
            {employers.slice(0, 10).map((e) => <li key={e.rank}>{e.employer} · {money(Number(e.total))} {tr("from", "de")} {e.contributions?.toLocaleString() ?? "—"} {tr("contributions", "contribuciones")}</li>)}
          </ol>
        </>
      )}
      {pacs.length > 0 && (
        <>
          <h4>{tr("PACs and other committees giving the most", "PAC y otros comités que más donaron")}</h4>
          <ol className="plain">
            {pacs.slice(0, 10).map((p) => <li key={p.rank}><a href={`https://www.fec.gov/data/committee/${p.contributor_committee_id}/`}>{p.contributor_name}</a> · {money(Number(p.total))}</li>)}
          </ol>
        </>
      )}
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
      <h2>{tr("Contact", "Contacto")}</h2>
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
      <p className="fine">{tr("Source", "Fuente")}: unitedstates/congress-legislators. {tr("Offices usually ask for your address to confirm you're a constituent.", "Las oficinas suelen pedir su dirección para confirmar que vive en su distrito o estado.")}</p>
    </section>
  );
}

const TABS = [["overview", "Overview", "Resumen"], ["votes", "Votes", "Votos"], ["bills", "Bills", "Proyectos"], ["money", "Money", "Dinero"], ["trades", "Stock trades", "Acciones"]];

function Section({ title, source, children }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
      {source && <p className="fine">{tr("Source", "Fuente")}: {source}</p>}
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
  const tabKeys = (e) => {
    const i = TABS.findIndex(([id]) => id === tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const id = TABS[(next + TABS.length) % TABS.length][0];
    navigate({ hash: id === "overview" ? "" : id }, { replace: true });
    requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus());
  };
  const tab = TABS.some(([id]) => `#${id}` === hash) ? hash.slice(1) : "overview";

  useEffect(() => {
    if (!BIOGUIDE.test(bioguide ?? "")) { setState({ status: "missing" }); return; }
    setState({ status: "loading" });
    loadMember(bioguide)
      .then((data) => setState(data.member ? { status: "done", data } : { status: "missing" }))
      .catch(() => setState({ status: "error" }));
  }, [bioguide]);

  if (state.status === "loading") return <main className="page"><p>{tr("Loading…", "Cargando…")}</p></main>;
  if (state.status === "missing") return <main className="page"><h1>{tr("Member not found", "Miembro no encontrado")}</h1><p><Link to="/">{tr("Back to search", "Volver a la búsqueda")}</Link></p></main>;
  if (state.status === "error") return <main className="page"><p className="notice">{tr("Couldn't load this page right now. Try again shortly.", "No se pudo cargar esta página. Inténtelo de nuevo en un momento.")}</p></main>;

  const { member: m, terms, seat, memberships, votes, bills, sponsoredCount, cosponsoredCount, finance, freshness, voteStats, medians, billStats, billMedians, trades, filings: scannedFilings, tradeSummary: ts, bySize, employers, pacs, outside, laws, candidacies } = state.data;
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
  const voteJob = Object.keys(fresh).find((j) => j.startsWith("votes-"));

  return (
    <main className="page full">
      <header className="page-head member-head">
        <img className="member-photo" src={`https://unitedstates.github.io/images/congress/225x275/${m.bioguide_id}.jpg`} alt={name} width="90" height="110" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        <h1>{name}</h1>
        {seat?.seat_status === "serving" ? (
          <p className="lede">{seatLabel(seat)} <PartyName party={seat.party} /> · {tr("Current term", "Período actual")} {date(seat.start_date)} – {date(seat.end_date)}</p>
        ) : (
          <p className="lede">{tr("Not currently serving. Most recent", "No está en el cargo. Último cargo")}: {seatLabel(latest)}, {date(latest.start_date)} – {date(latest.end_date)} <PartyName party={latest.party} /></p>
        )}
      </header>

      {/* Arrow keys, Home and End move between tabs (the standard tab pattern); Tab moves into the panel. */}
      <nav className="tabs" role="tablist" aria-label={tr("Sections of this page", "Secciones de esta página")}>
        {TABS.map(([id, label, labelEs]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1} onKeyDown={tabKeys}
            className={tab === id ? "on" : ""} onClick={() => navigate({ hash: id === "overview" ? "" : id }, { replace: true })}>
            {tr(label, labelEs)}
          </button>
        ))}
      </nav>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === "overview" && <div className="split">
      <aside className="split-aside">
      {seat?.seat_status === "serving" && <Contact term={terms[0]} member={m} />}
      <Follow feed={`/api/feed/member/${m.bioguide_id}`} calendar={`/api/calendar/member/${m.bioguide_id}`}
        calendarLabel={tr("Add their committees' hearings to your calendar", "Agregar a su calendario las audiencias de sus comités")} />
      <EmbedCode path={`/embed/member/${m.bioguide_id}`} title={`${name} · Civic Atlas`} />

      </aside>
      <div className="split-main">
      <AtAGlance terms={terms} voteStats={voteStats} medians={medians} billStats={billStats} laws={laws}
        finance={finance} bySize={bySize} tradeSummary={ts} delegate={delegate(latest)} />

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
              {" "}<Link to={`/elections?state=${seat.state}`}>{tr("Who has filed in", "Quién se ha inscrito en")} {stateName(seat.state)}</Link>
            </p>
          );
        })()}
        <ul className="plain">
          {terms.map((t) => (
            <li key={`${t.chamber}-${t.start_date}`}>{seatLabel(t)} <PartyName party={t.party} /> · {date(t.start_date)} – {date(t.end_date)}</li>
          ))}
        </ul>
      </Section>

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

      </div>
      </div>}

      {tab === "votes" && <>
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
          <table>
            <thead><tr><th>{tr("Date", "Fecha")}</th><th>{tr("Question", "Asunto")}</th><th>{tr("Vote", "Voto")}</th><th>{tr("Result", "Resultado")}</th></tr></thead>
            <tbody>
              {votes.filter((v) => !finalOnly || isFinal(v)).slice(0, 15).map((v) => (
                <tr key={v.vote_id}>
                  <td>{date(v.voted_at)}</td>
                  <td>
                    <KindLabel v={v} />
                    <a href={v.source_url}>{v.question}</a>
                    {(v.document_name || v.description) && <div className="fine">{[v.document_name, v.description].filter(Boolean).join(" · ")}</div>}
                  </td>
                  <td><Position v={v} position={v.vote_positions[0]?.position} /></td>
                  <td>{v.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {finalOnly && votes.filter(isFinal).length === 0 && <p className="fine">{tr("No final votes among the most recent 120 roll calls.", "No hay votos finales entre las 120 votaciones más recientes.")}</p>}
          <p><Link to={`/member/${m.bioguide_id}/votes`}>{tr("All votes, searchable by issue →", "Todos los votos, con búsqueda por tema (en inglés) →")}</Link></p>
          </>
        )}
      </Section>

      </>}

      {tab === "bills" && <>
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
                <div className="fine">{tr("Introduced", "Presentado el")} {date(b.introduced_date)}{b.latest_action_text && <> · {tr("Latest action", "Última acción")} {date(b.latest_action_date)}: {b.latest_action_text}</>}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      </>}

      {tab === "trades" && <>
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
                      <td>{t.ticker ? <><strong>{t.ticker}</strong> · </> : null}{t.asset_name}</td>
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

      </>}

      {tab === "money" && <>
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
        {detailCycle > 0 && <FinanceDetail cycle={detailCycle} bySize={inCycle(bySize)} employers={inCycle(employers)} pacs={inCycle(pacs)} outside={inCycle(outside)} fecId={finance.find((f) => f.cycle === detailCycle)?.fec_candidate_id} />}
      </Section>
      </>}
      </div>
    </main>
  );
}
