import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { date, billLabel, ordinal, partyTag } from "../lib/format.js";
import VoteBreakdown from "../components/VoteBreakdown.jsx";
import StatusBar from "../components/StatusBar.jsx";
import Follow from "../components/Follow.jsx";
import { Explain } from "../components/Explain.jsx";

const TYPES = new Set(["hr", "s", "hres", "sres", "hjres", "sjres", "hconres", "sconres"]);
const LOBBY_PREVIEW = 40;
const quarter = (k) => (k ? `Q${k % 10} ${Math.floor(k / 10)}` : "");
const filingUrl = (uuid) => `https://lda.gov/filings/public/filing/${uuid}/print/`;

async function loadBill(congress, type, number) {
  const one = (q) => q.then(({ data, error }) => { if (error) throw error; return data; });
  const key = (q) => q.eq("congress", congress).eq("bill_type", type).eq("number", number);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const [bill, sponsor, cosponsors, votes, lobbying, lobbyCount, freshness, scheduled] = await Promise.all([
    one(key(db.from("bills").select("*")).maybeSingle()),
    one(key(db.from("bill_sponsor_details").select("*")).maybeSingle()),
    one(key(db.from("bill_cosponsor_details").select("*")).order("sponsored_date").order("last_name")),
    one(db.from("votes").select("vote_id,chamber,voted_at,question,result,yea_total,nay_total,present_total,not_voting_total,source_url")
      .eq("bill_congress", congress).eq("bill_type", type).eq("bill_number", number).order("voted_at", { ascending: false })),
    one(key(db.from("bill_lobbying").select("*")).order("quarters", { ascending: false }).order("client_name").limit(1000)),
    one(key(db.from("bill_lobbying_counts").select("clients")).maybeSingle()),
    one(db.from("data_freshness").select("*")),
    one(db.from("upcoming_events").select("event_id,chamber,kind,event_date,event_time,week_of,category,committee_id,committee_name,title,source_url")
      .contains("bill_refs", [`${congress}-${type}-${number}`]).gte("event_date", weekAgo).order("event_date")),
  ]);
  return { bill, sponsor, cosponsors, votes, lobbying, lobbyTotal: lobbyCount?.clients ?? lobbying.length, freshness, scheduled };
}

function Section({ title, source, children }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
      {source && <p className="fine">Source: {source}</p>}
    </section>
  );
}

export default function Bill() {
  const { congress: c, type: t, number: n } = useParams();
  const congress = Number(c), type = String(t ?? "").toLowerCase(), number = Number(n);
  const valid = Number.isInteger(congress) && TYPES.has(type) && Number.isInteger(number) && number > 0;
  const [state, setState] = useState({ status: "loading" });
  const [allLobbying, setAllLobbying] = useState(false);
  const [openVote, setOpenVote] = useState(null);

  useEffect(() => {
    if (!valid) { setState({ status: "missing" }); return; }
    setState({ status: "loading" });
    setAllLobbying(false);
    loadBill(congress, type, number)
      .then((data) => setState(data.bill ? { status: "done", data } : { status: "missing" }))
      .catch(() => setState({ status: "error" }));
  }, [congress, type, number, valid]);

  if (state.status === "loading") return <main className="page"><p>Loading…</p></main>;
  if (state.status === "missing") return <main className="page"><h1>Bill not found</h1><p>Bills from the 118th Congress (2023) on are covered. <Link to="/">Back to search</Link></p></main>;
  if (state.status === "error") return <main className="page"><p className="notice">Couldn't load this page right now. Try again shortly.</p></main>;

  const { bill: b, sponsor, cosponsors, votes, lobbying, lobbyTotal, freshness, scheduled } = state.data;
  const fresh = Object.fromEntries(freshness.map((f) => [f.job, f.last_success_at]));
  const updated = (job) => (fresh[job] ? ` Updated ${date(fresh[job])}.` : "");
  const current = cosponsors.filter((x) => !x.withdrawn_date);
  const withdrawn = cosponsors.filter((x) => x.withdrawn_date);
  const byParty = Object.entries(current.reduce((acc, x) => ({ ...acc, [x.party ?? "Unknown"]: (acc[x.party ?? "Unknown"] ?? 0) + 1 }), {}))
    .sort((a, z) => a[0].localeCompare(z[0]));
  const shownLobbying = allLobbying ? lobbying : lobbying.slice(0, LOBBY_PREVIEW);
  const person = (p) => (
    <><Link to={`/member/${p.bioguide_id}`}>{p.name}</Link>{p.party && <> ({partyTag(p)})</>}</>
  );

  return (
    <main className="page">
      <header>
        <p className="fine">{billLabel(b)} · {ordinal(b.congress)} Congress · <Explain id="bill-types">What's an {billLabel(b).replace(/\s*\d+$/, "")}?</Explain></p>
        <h1 className="bill-title">{b.short_title ?? b.title}</h1>
        {b.short_title && b.short_title !== b.title && <p className="lede">{b.title}</p>}
        {sponsor && <p>Sponsor: {person(sponsor)}</p>}
        <p className="fine">
          Introduced {date(b.introduced_date)}{b.policy_area && <> · Policy area: {b.policy_area}</>}
        </p>
        {b.latest_action_text && <p>Latest action ({date(b.latest_action_date)}): {b.latest_action_text}</p>}
        <p className="fine"><a href={b.source_url}>Full text, actions and history at Congress.gov</a></p>
        <Follow feed={`/api/feed/bill/${b.congress}/${b.bill_type}/${b.number}`} />
      </header>

      <StatusBar bill={b} />
      {scheduled.length > 0 && (
        <div className="notice-box">
          <strong>Scheduled</strong>
          <ul className="plain">
            {scheduled.map((e) => (
              <li key={e.event_id}>
                {e.kind === "floor"
                  ? <>On the House floor schedule for the week of {date(e.event_date)}{e.category === "suspension" ? " as a fast-track vote (needs two-thirds)" : e.category === "rule" ? " under a rule" : ""}.</>
                  : <>{e.chamber === "house" ? "House" : "Senate"} {e.committee_id ? <Link to={`/committee/${e.committee_id}`}>{e.committee_name}</Link> : e.committee_name} {e.kind}, {date(e.event_date)}{e.event_time ? ` at ${e.event_time} ET` : ""}.</>}
                {" "}<a href={e.source_url} className="fine">Schedule</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Summary" source={<>Congressional Research Service, via GovInfo Bill Status. <Explain id="crs-summary">About these summaries</Explain></>}>
        {b.crs_summary
          ? <p>{b.crs_summary}</p>
          : <p>The Congressional Research Service hasn't published a summary of this bill yet. The bill text is at Congress.gov.</p>}
      </Section>

      <Section title="Cosponsors" source={`GovInfo Bill Status (Library of Congress).${updated("bills")} Party and seat as of the day each member signed on.`}>
        {current.length === 0 ? <p>No cosponsors.</p> : (
          <>
            <p>{current.length} cosponsor{current.length === 1 ? "" : "s"}: {byParty.map(([p, k]) => `${k} ${p}`).join(", ")}.</p>
            <ul className="plain columns">
              {current.map((x) => (
                <li key={x.bioguide_id}>{person(x)} <span className="fine">· {date(x.sponsored_date)}{x.is_original ? " · original" : ""}</span></li>
              ))}
            </ul>
          </>
        )}
        {withdrawn.length > 0 && (
          <p className="fine">Withdrawn: {withdrawn.map((x, i) => <span key={x.bioguide_id}>{i ? "; " : ""}{x.name} ({date(x.withdrawn_date)})</span>)}</p>
        )}
      </Section>

      <Section title="Roll-call votes" source={<>House Clerk and Senate.gov roll-call records. <Link to="/methods#vote-types">About vote types</Link>.</>}>
        {votes.length === 0 ? <p>No recorded roll-call votes on this bill. Many bills pass by voice vote or never reach the floor.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Chamber</th><th>Question</th><th>Result</th><th>Yea–Nay</th></tr></thead>
            <tbody>
              {votes.map((v) => (
                <Fragment key={v.vote_id}>
                  <tr>
                    <td>{date(v.voted_at)}</td>
                    <td>{v.chamber === "house" ? "House" : "Senate"}</td>
                    <td>
                      <a href={v.source_url}>{v.question}</a>
                      <div><button className="link fine" aria-expanded={openVote === v.vote_id}
                        onClick={() => setOpenVote(openVote === v.vote_id ? null : v.vote_id)}>
                        {openVote === v.vote_id ? "Hide how members voted" : "How members voted"}
                      </button></div>
                    </td>
                    <td>{v.result}</td>
                    <td>{v.yea_total}–{v.nay_total}</td>
                  </tr>
                  {openVote === v.vote_id && <tr><td colSpan={5}><VoteBreakdown voteId={v.vote_id} /></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Lobbying reports naming this bill"
        source={<>Quarterly lobbying reports (LD-2) filed under the Lobbying Disclosure Act, retrieved from LDA.gov.{updated("lobbying")} The Senate Office of Public Records can't vouch for data or analyses derived from these reports after they're retrieved. <Link to="/methods#lobbying">About this data</Link>.</>}>
        {lobbying.length === 0 ? <p>No lobbying reports on file name this bill.</p> : (
          <>
            <p>
              {lobbyTotal.toLocaleString()} organization{lobbyTotal === 1 ? "" : "s"} reported lobbying on this bill.
              A report lists the bill; it doesn't say whether the organization supported or opposed it.
            </p>
            <table>
              <thead><tr><th>Client</th><th>Lobbying done by</th><th>Quarters</th><th>Report</th></tr></thead>
              <tbody>
                {shownLobbying.map((l) => {
                  const firms = l.registrants.filter((r) => r !== l.client_name);
                  return (
                    <tr key={l.client_id}>
                      <td>{l.client_name}</td>
                      <td>{firms.length ? firms.join("; ") : <span className="fine">In-house</span>}</td>
                      <td>{l.quarters === 1 ? quarter(l.first_quarter_key) : `${l.quarters} (${quarter(l.first_quarter_key)}–${quarter(l.last_quarter_key)})`}</td>
                      <td><a href={filingUrl(l.latest_filing_uuid)}>Latest</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {lobbying.length > LOBBY_PREVIEW && !allLobbying && (
              <p><button className="link" onClick={() => setAllLobbying(true)}>
                {lobbying.length < lobbyTotal ? `Show ${lobbying.length.toLocaleString()} with the most quarters` : `Show all ${lobbying.length.toLocaleString()}`}
              </button></p>
            )}
            {allLobbying && lobbying.length < lobbyTotal && (
              <p className="fine">Showing {lobbying.length.toLocaleString()} of {lobbyTotal.toLocaleString()}. Search every report at <a href="https://lda.gov/filings/public/filing/search/">LDA.gov</a>.</p>
            )}
          </>
        )}
      </Section>
    </main>
  );
}
