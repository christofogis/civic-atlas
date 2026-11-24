import { useEffect, useState } from "react";
import { voteKind, isFinal } from "../lib/voteKind.js";
import { Link, useParams, useLocation, useNavigate } from "react-router-dom";
import { db } from "../lib/db.js";
import { seatNextUp, nextElectionYear } from "../../lib/congress.js";
import AtAGlance from "../components/AtAGlance.jsx";
import Scale from "../components/Scale.jsx";
import Follow from "../components/Follow.jsx";
import { KindLabel } from "../components/Explain.jsx";
import { seatLabel, date, money, billLabel, ordinal, STATE_NAMES } from "../lib/format.js";

const BIOGUIDE = /^[A-Z][0-9]{6}$/;
const TERRITORIES = new Set(["DC", "PR", "GU", "VI", "AS", "MP"]);
const MIN_SPLIT_VOTES = 20; // below this, a rate says more about the sample than the member
const pct = (n, d) => (d ? `${(Math.round((1000 * n) / d) / 10).toFixed(1)}%` : "—");
const partyAdj = (p) => (p === "Democrat" ? "Democratic" : p);

// One Congress and chamber of party-line and attendance figures, in plain sentences.
function VoteStats({ s, median, delegate, independent }) {
  const party = partyAdj(s.scoring_party);
  return (
    <div className="stat-block">
      <h3>{ordinal(s.congress)} Congress, {s.chamber === "house" ? "House" : "Senate"}</h3>
      {s.party_split_votes < MIN_SPLIT_VOTES ? (
        <p>Party-line rate: not calculated ({s.party_split_votes} party-split votes; at least {MIN_SPLIT_VOTES} needed).</p>
      ) : (
        <p>
          Voted with the {party} majority on <strong>{pct(s.with_party, s.party_split_votes)}</strong> of
          party-split votes ({s.with_party.toLocaleString()} of {s.party_split_votes.toLocaleString()})
          {independent && <> — the party this member caucuses with</>}.
          {median && !delegate && <> Chamber median: {pct(median.median_party_line_rate * 1000, 1000)}.</>}
        </p>
      )}
      {s.party_split_votes >= MIN_SPLIT_VOTES && (
        <Scale value={s.with_party / s.party_split_votes} typical={median && !delegate ? median.median_party_line_rate : null}
          label={`with the ${party} majority`} typicalLabel="chamber median" />
      )}
      <p>
        Missed <strong>{pct(s.missed, s.roll_calls)}</strong> of roll-call votes ({s.missed.toLocaleString()} of {s.roll_calls.toLocaleString()}).
        {median && !delegate && <> Chamber median: {pct(median.median_missed_rate * 1000, 1000)}.</>}
      </p>
      {s.roll_calls > 0 && <Scale value={s.missed / s.roll_calls} typical={median && !delegate ? median.median_missed_rate : null}
        label="of roll calls missed" typicalLabel="chamber median" />}
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

const SIZE_LABEL = { 0: "Under $200", 200: "$200–$499", 500: "$500–$999", 1000: "$1,000–$1,999", 2000: "$2,000 and over" };

// Where the money came from in one cycle: size of individual gifts, donors' employers, PACs,
// and outside groups' spending. All figures are FEC aggregates; no donor is named.
function FinanceDetail({ cycle, bySize, employers, pacs, outside, fecId }) {
  const sizeTotal = bySize.reduce((a, r) => a + Number(r.total ?? 0), 0);
  const support = outside.filter((o) => o.support_oppose === "support");
  const oppose = outside.filter((o) => o.support_oppose === "oppose");
  const sum = (rows) => rows.reduce((a, r) => a + Number(r.total ?? 0), 0);
  return (
    <div className="finance-detail">
      <h3>{cycle} cycle in detail</h3>
      {bySize.length > 0 && (
        <>
          <h4>Individual contributions by size</h4>
          <table>
            <tbody>
              {[...bySize].sort((a, b) => a.size_bucket - b.size_bucket).map((r) => (
                <tr key={r.size_bucket}><td>{SIZE_LABEL[r.size_bucket] ?? `$${r.size_bucket}+`}</td><td>{money(Number(r.total))}</td><td>{sizeTotal ? `${Math.round((100 * Number(r.total)) / sizeTotal)}%` : ""}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {employers.length > 0 && (
        <>
          <h4>Donors' employers</h4>
          <p className="fine">Contributions from individuals who listed these employers. Companies can't give directly to federal campaigns.</p>
          <ol className="plain">
            {employers.slice(0, 10).map((e) => <li key={e.rank}>{e.employer} · {money(Number(e.total))} from {e.contributions?.toLocaleString() ?? "—"} contributions</li>)}
          </ol>
        </>
      )}
      {pacs.length > 0 && (
        <>
          <h4>PACs and other committees giving the most</h4>
          <ol className="plain">
            {pacs.slice(0, 10).map((p) => <li key={p.rank}><a href={`https://www.fec.gov/data/committee/${p.contributor_committee_id}/`}>{p.contributor_name}</a> · {money(Number(p.total))}</li>)}
          </ol>
        </>
      )}
      {outside.length > 0 && (
        <>
          <h4>Outside spending</h4>
          <p className="fine">Independent expenditures by groups not coordinating with the campaign.</p>
          <p>Supporting: <strong>{money(sum(support))}</strong> · Opposing: <strong>{money(sum(oppose))}</strong></p>
          <ul className="plain">
            {outside.slice(0, 8).map((o) => <li key={`${o.committee_id}-${o.support_oppose}`}><a href={`https://www.fec.gov/data/committee/${o.committee_id}/`}>{o.committee_name}</a> · {o.support_oppose === "support" ? "supporting" : "opposing"} · {money(Number(o.total))}</li>)}
          </ul>
        </>
      )}
      {fecId && <p className="fine"><a href={`https://www.fec.gov/data/candidate/${fecId}/?cycle=${cycle}`}>Full records at FEC.gov</a></p>}
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
      <h2>Contact</h2>
      {term.phone && <p>Washington office: <a href={`tel:+1-${term.phone}`}>{term.phone}</a></p>}
      {term.address && <p className="fine">{term.address}</p>}
      <p>
        {term.contact_form && <><a href={term.contact_form}>Email through the official contact form</a></>}
        {term.contact_form && term.url && " · "}
        {term.url && <a href={term.url}>Official website</a>}
      </p>
      {accounts.length > 0 && (
        <p className="fine">Official accounts: {accounts.map(([k, label, link], i) => (
          <span key={k}>{i ? " · " : ""}<a href={link(member[k])} rel="noopener noreferrer">{label}</a></span>
        ))}</p>
      )}
      <p className="fine">Source: unitedstates/congress-legislators. Offices usually ask for your address to confirm you're a constituent.</p>
    </section>
  );
}

const TABS = [["overview", "Overview"], ["votes", "Votes"], ["bills", "Bills"], ["money", "Money"], ["trades", "Stock trades"]];

function Section({ title, source, children }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
      {source && <p className="fine">Source: {source}</p>}
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

  if (state.status === "loading") return <main className="page"><p>Loading…</p></main>;
  if (state.status === "missing") return <main className="page"><h1>Member not found</h1><p><Link to="/">Back to search</Link></p></main>;
  if (state.status === "error") return <main className="page"><p className="notice">Couldn't load this page right now. Try again shortly.</p></main>;

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
  const updated = (job) => (fresh[job] ? ` Updated ${date(fresh[job])}.` : "");
  const voteJob = Object.keys(fresh).find((j) => j.startsWith("votes-"));

  return (
    <main className="page">
      <header>
        <h1>{name}</h1>
        {seat?.seat_status === "serving" ? (
          <p className="lede">{seatLabel(seat)} · {seat.party} · Current term {date(seat.start_date)} – {date(seat.end_date)}</p>
        ) : (
          <p className="lede">Not currently serving. Most recent: {seatLabel(latest)}, {date(latest.start_date)} – {date(latest.end_date)} ({latest.party})</p>
        )}
      </header>

      {/* Arrow keys, Home and End move between tabs (the standard tab pattern); Tab moves into the panel. */}
      <nav className="tabs" role="tablist" aria-label="Sections of this page">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1} onKeyDown={tabKeys}
            className={tab === id ? "on" : ""} onClick={() => navigate({ hash: id === "overview" ? "" : id }, { replace: true })}>
            {label}
          </button>
        ))}
      </nav>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === "overview" && <>
      <Follow feed={`/api/feed/member/${m.bioguide_id}`} calendar={`/api/calendar/member/${m.bioguide_id}`}
        calendarLabel="Add their committees' hearings to your calendar" />
      {seat?.seat_status === "serving" && <Contact term={terms[0]} member={m} />}

      <AtAGlance terms={terms} voteStats={voteStats} medians={medians} billStats={billStats} laws={laws}
        finance={finance} bySize={bySize} tradeSummary={ts} delegate={delegate(latest)} />

      <Section title="Service in Congress" source={<>unitedstates/congress-legislators.{updated("members")} Biography: <a href={m.source_url}>Biographical Directory of the U.S. Congress</a>.</>}>
        {seat?.seat_status === "serving" && (() => {
          const upIn = seatNextUp(seat.chamber, seat.senate_class);
          const filed = candidacies.find((c) => c.election_year === upIn);
          return upIn && (
            <p>
              This seat is next up for election in {upIn}.
              {upIn === nextElectionYear() && (filed
                ? <> Has filed with the FEC to run in {upIn}{filed.office === "S" ? " for the Senate" : ` for the House${filed.district ? `, District ${filed.district}` : ""}`} (<a href={`https://www.fec.gov/data/candidate/${filed.fec_candidate_id}/`}>FEC</a>).</>
                : <> Hasn't filed with the FEC for {upIn} yet.</>)}
              {" "}<Link to={`/elections?state=${seat.state}`}>Who has filed in {STATE_NAMES[seat.state] ?? seat.state}</Link>
            </p>
          );
        })()}
        <ul className="plain">
          {terms.map((t) => (
            <li key={`${t.chamber}-${t.start_date}`}>{seatLabel(t)} · {t.party} · {date(t.start_date)} – {date(t.end_date)}</li>
          ))}
        </ul>
      </Section>

      <Section title={currentCongress ? `Committees (${ordinal(currentCongress)} Congress)` : "Committees"} source={`unitedstates/congress-legislators.${updated("committees")}`}>
        {fullCommittees.length === 0 ? <p>No committee assignments on record.</p> : (
          <ul className="plain">
            {fullCommittees.map((c) => (
              <li key={c.committee.committee_id}>
                <Link to={`/committee/${c.committee.committee_id}`}>{c.committee.name}</Link>
                {c.title && <> · {c.title}</>}
                {subsByParent(c.committee.committee_id).length > 0 && (
                  <ul>{subsByParent(c.committee.committee_id).map((s) => (
                    <li key={s.committee.committee_id}><Link to={`/committee/${s.committee.committee_id}`}>{s.committee.name}</Link>{s.title && <> · {s.title}</>}</li>
                  ))}</ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      </>}

      {tab === "votes" && <>
      <Section title="Voting record" source={<>Calculated from House Clerk and Senate.gov roll-call records. <Link to="/methods">How these are calculated</Link>.</>}>
        {voteStats.length === 0 ? <p>No roll-call votes on record since 2023.</p> : (
          <>
            {delegate(latest) && (
              <p className="notice">
                Delegates and the Resident Commissioner can vote only on certain amendment votes, so these
                figures cover far fewer roll calls than a member's and aren't compared with the chamber.
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

      <Section title="Recent roll-call votes" source={<>House Clerk and Senate.gov roll-call records; positions as recorded.{voteJob ? updated(voteJob) : ""} <Link to="/methods#vote-types">About vote types</Link>.</>}>
        {votes.length === 0 ? <p>No roll-call votes on record since 2023.</p> : (
          <>
          <div className="toggle" role="group" aria-label="Which votes to show">
            <button type="button" aria-pressed={!finalOnly} className={finalOnly ? "" : "on"} onClick={() => setFinalOnly(false)}>All votes</button>
            <button type="button" aria-pressed={finalOnly} className={finalOnly ? "on" : ""} onClick={() => setFinalOnly(true)}>Final votes only</button>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Question</th><th>Vote</th><th>Result</th></tr></thead>
            <tbody>
              {votes.filter((v) => !finalOnly || isFinal(v)).slice(0, 15).map((v) => (
                <tr key={v.vote_id}>
                  <td>{date(v.voted_at)}</td>
                  <td>
                    <KindLabel v={v} />
                    <a href={v.source_url}>{v.question}</a>
                    {(v.document_name || v.description) && <div className="fine">{[v.document_name, v.description].filter(Boolean).join(" · ")}</div>}
                  </td>
                  <td>{v.vote_positions[0]?.position}</td>
                  <td>{v.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {finalOnly && votes.filter(isFinal).length === 0 && <p className="fine">No final votes among the most recent 120 roll calls.</p>}
          <p><Link to={`/member/${m.bioguide_id}/votes`}>All votes, searchable by issue →</Link></p>
          </>
        )}
      </Section>

      </>}

      {tab === "bills" && <>
      <Section title="Legislation" source={`GovInfo Bill Status (Library of Congress), 118th Congress on.${updated("bills")}`}>
        <p>Sponsored: {sponsoredCount ?? 0} · Cosponsored: {cosponsoredCount ?? 0}</p>
        {billStats.map((b) => {
          const med = billMedians.find((x) => x.congress === b.congress && x.chamber === b.chamber);
          return (
            <div className="stat-block" key={`${b.congress}-${b.chamber}`}>
              <h3>{ordinal(b.congress)} Congress, {b.chamber === "house" ? "House" : "Senate"}</h3>
              {b.cosponsored >= 20 ? (
                <p>
                  Of the {b.cosponsored.toLocaleString()} bills they cosponsored, <strong>{pct(b.cosponsored_other_party, b.cosponsored)}</strong> were
                  introduced by a member of the other party.
                  {med?.median_cross_party_cosponsor_rate != null && <> Chamber median: {pct(med.median_cross_party_cosponsor_rate * 1000, 1000)}.</>}
                </p>
              ) : <p>Cosponsored {b.cosponsored} bills (too few to calculate a cross-party rate).</p>}
              {b.sponsored >= 10 ? (
                <p>
                  Of the {b.sponsored.toLocaleString()} bills they introduced, <strong>{pct(b.sponsored_with_other_party, b.sponsored)}</strong> had
                  at least one cosponsor from the other party.
                  {med?.median_cross_party_support_rate != null && <> Chamber median: {pct(med.median_cross_party_support_rate * 1000, 1000)}.</>}
                </p>
              ) : b.sponsored > 0 && <p>Introduced {b.sponsored} bills (too few to calculate a cross-party rate).</p>}
            </div>
          );
        })}
        <p className="fine"><Link to="/methods#cosponsorship">How these are calculated</Link>.</p>
        {bills.length > 0 && (
          <ul className="plain">
            {bills.map((b) => (
              <li key={`${b.congress}-${b.bill_type}-${b.number}`}>
                <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link> ({ordinal(b.congress)}) · {b.short_title ?? b.title}{b.law_number && <> · <strong>{b.law_number}</strong></>}
                <div className="fine">Introduced {date(b.introduced_date)}{b.latest_action_text && <> · Latest action {date(b.latest_action_date)}: {b.latest_action_text}</>}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      </>}

      {tab === "trades" && <>
      <Section title="Stock trades" source={<>Periodic Transaction Reports filed under the STOCK Act with the House Clerk and Senate, 2025 on.{updated("trades")} <Link to="/methods#trades">About this data</Link>.</>}>
        {!ts ? <p>No periodic transaction reports on record since 2025.</p> : (
          <>
            <p>
              {ts.filings} report{ts.filings === 1 ? "" : "s"} filed, listing {ts.trades.toLocaleString()} transaction{ts.trades === 1 ? "" : "s"}.
              {ts.trades_with_dates > 0 && <> Reported more than 45 days after the transaction: <strong>{ts.reported_after_45_days.toLocaleString()}</strong> of {ts.trades_with_dates.toLocaleString()}.</>}
            </p>
            {scannedFilings.length > 0 && (
              <p className="fine">
                {scannedFilings.length} report{scannedFilings.length === 1 ? " was" : "s were"} filed on paper and {scannedFilings.length === 1 ? "is" : "are"} linked
                but not itemized: {scannedFilings.map((f, i) => <span key={f.filing_id}>{i ? ", " : ""}<a href={f.source_url}>{date(f.filed_date)}</a></span>)}.
              </p>
            )}
            {trades.length > 0 && (
              <table>
                <thead><tr><th>Traded</th><th>Asset</th><th>Type</th><th>Amount</th><th>Owner</th><th>Reported</th></tr></thead>
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
                        {t.is_amendment && <div className="fine">in an amended report</div>}
                        {!t.is_amendment && t.days_to_file != null && t.days_to_file >= 0 && <div className={t.days_to_file > 45 ? "fine late" : "fine"}>{t.days_to_file} days{t.days_to_file > 45 ? " (over 45)" : ""}</div>}
                        {t.days_to_file != null && t.days_to_file < 0 && <div className="fine">Trade date as filed is after the report date</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {ts.trades > trades.length && <p className="fine">Showing the {trades.length} most recent of {ts.trades.toLocaleString()}. Each links to its report.</p>}
          </>
        )}
      </Section>

      </>}

      {tab === "money" && <>
      <Section title="Campaign finance" source={<>Federal Election Commission (OpenFEC).{updated("fec-summaries")} <Link to="/methods#money">About this data</Link>.</>}>
        {finance.length === 0 ? <p>No FEC filings on record for this member.</p> : (
          <table>
            <thead><tr><th>Cycle</th><th>Raised</th><th>Spent</th><th>Cash on hand</th><th>Individuals</th><th>PACs</th><th>Through</th></tr></thead>
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
          <div className="toggle" role="group" aria-label="Election cycle to show in detail">
            {detailCycles.map((c) => <button key={c} type="button" aria-pressed={c === detailCycle} className={c === detailCycle ? "on" : ""} onClick={() => setPickedCycle(c)}>{c} cycle</button>)}
          </div>
        )}
        {detailCycle > 0 && <FinanceDetail cycle={detailCycle} bySize={inCycle(bySize)} employers={inCycle(employers)} pacs={inCycle(pacs)} outside={inCycle(outside)} fecId={finance.find((f) => f.cycle === detailCycle)?.fec_candidate_id} />}
      </Section>
      </>}
      </div>
    </main>
  );
}
