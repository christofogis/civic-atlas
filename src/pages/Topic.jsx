import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, ordinal, date } from "../lib/format.js";
import { areaFromSlug } from "../lib/policyAreas.js";
import { congressOn, congressYears } from "../../lib/congress.js";
import { KindLabel } from "../components/Explain.jsx";

const CURRENT = congressOn();
const BILL = "congress,bill_type,number,title,short_title,latest_action_date,latest_action_text,became_law_date,law_number,passed_house_date,passed_senate_date";

// One subject across a Congress: what became law, what passed a chamber, the bills most
// organizations lobbied on, and recent roll-call votes. Lists only; no ranking of members.
export default function Topic() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const congress = Number(params.get("congress")) || CURRENT;
  const area = areaFromSlug(slug);
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    if (!area) { setState({ status: "missing" }); return; }
    setState({ status: "loading" });
    const base = () => db.from("bills").select(BILL).eq("congress", congress).eq("policy_area", area);
    Promise.all([
      db.from("topic_stats").select("*").eq("congress", congress).eq("policy_area", area).maybeSingle(),
      base().not("became_law_date", "is", null).order("became_law_date", { ascending: false }).limit(100),
      base().is("became_law_date", null).or("passed_house_date.not.is.null,passed_senate_date.not.is.null")
        .order("latest_action_date", { ascending: false }).limit(50),
      db.from("bill_list_lobbied").select("congress,bill_type,number,title,short_title,lobbying_clients")
        .eq("congress", congress).eq("policy_area", area).order("lobbying_clients", { ascending: false }).limit(10),
      db.from("vote_list").select("*").eq("congress", congress).eq("policy_area", area).order("voted_at", { ascending: false }).limit(25),
    ]).then(([stats, laws, passed, lobbied, votes]) => {
      const err = [stats, laws, passed, lobbied, votes].find((r) => r.error);
      setState(err ? { status: "error" } : { status: "done", stats: stats.data, laws: laws.data, passed: passed.data, lobbied: lobbied.data, votes: votes.data });
    });
  }, [area, congress]);

  if (state.status === "missing") return <main className="page"><h1>Topic not found</h1><p><Link to="/topics">All topics</Link></p></main>;
  if (state.status === "error") return <main className="page"><p className="notice">Couldn't load this topic right now.</p></main>;
  const link = (b) => <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link>;
  const s = state.stats;

  return (
    <main className="page wide">
      <p className="fine"><Link to="/topics">Topics</Link></p>
      <h1>{area}</h1>
      <div className="filters">
        <label>Congress{" "}
          <select value={congress} onChange={(e) => setParams({ congress: e.target.value })}>
            {Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i).map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
          </select>
        </label>
      </div>
      {state.status === "loading" ? <p>Loading…</p> : (
        <>
          <p className="lede">
            {s ? <>In the {ordinal(congress)} Congress, {s.bills.toLocaleString()} bills and resolutions on this topic were introduced;
              {" "}{s.passed_any.toLocaleString()} passed at least one chamber and {s.laws.toLocaleString()} became law.</>
              : <>No bills on this topic in the {ordinal(congress)} Congress yet.</>}
          </p>
          <p><Link to={`/bills?congress=${congress}&issue=${encodeURIComponent(area)}`}>Browse every bill on this topic →</Link></p>

          <section className="section">
            <h2>Became law</h2>
            {state.laws.length === 0 ? <p>None yet.</p> : (
              <ul className="plain">{state.laws.map((b) => <li key={b.number + b.bill_type}>{link(b)} {b.short_title ?? b.title} <span className="fine">· {b.law_number}, {date(b.became_law_date)}</span></li>)}</ul>
            )}
          </section>

          <section className="section">
            <h2>Passed one chamber or more, not yet law</h2>
            {state.passed.length === 0 ? <p>None.</p> : (
              <ul className="plain">{state.passed.map((b) => (
                <li key={b.number + b.bill_type}>{link(b)} {b.short_title ?? b.title}
                  <div className="fine">{[b.passed_house_date && `Passed House ${date(b.passed_house_date)}`, b.passed_senate_date && `Passed Senate ${date(b.passed_senate_date)}`].filter(Boolean).join(" · ")}</div></li>
              ))}</ul>
            )}
            {state.passed.length === 50 && <p className="fine">Showing the 50 with the most recent action.</p>}
          </section>

          <section className="section">
            <h2>Bills the most organizations lobbied on</h2>
            {state.lobbied.length === 0 ? <p>No lobbying reports name bills on this topic yet.</p> : (
              <ul className="plain">{state.lobbied.map((b) => <li key={b.number + b.bill_type}>{link(b)} {b.short_title ?? b.title} <span className="fine">· {b.lobbying_clients.toLocaleString()} organizations</span></li>)}</ul>
            )}
            <p className="fine">From LD-2 lobbying reports that name the bill. A listing doesn't say whether the organization supported or opposed it.</p>
          </section>

          <section className="section">
            <h2>Recent roll-call votes</h2>
            {state.votes.length === 0 ? <p>None recorded.</p> : (
              <table>
                <thead><tr><th>Date</th><th>Vote</th><th>Result</th></tr></thead>
                <tbody>
                  {state.votes.map((v) => (
                    <tr key={v.vote_id}>
                      <td>{date(v.voted_at)}<div className="fine">{v.chamber === "house" ? "House" : "Senate"}</div></td>
                      <td><KindLabel v={v} /> <a href={v.source_url}>{v.question}</a>
                        <div className="fine">{link({ congress: v.bill_congress, bill_type: v.bill_type, number: v.bill_number })} {v.bill_title}</div></td>
                      <td>{v.result}<div className="fine">{v.yea_total}–{v.nay_total}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <p className="fine">Sources: GovInfo Bill Status (Library of Congress); House Clerk and Senate.gov roll calls; LDA.gov.</p>
        </>
      )}
    </main>
  );
}
