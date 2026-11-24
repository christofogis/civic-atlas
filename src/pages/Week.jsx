import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, date } from "../lib/format.js";
import { isFinal } from "../lib/voteKind.js";
import { KindLabel } from "../components/Explain.jsx";
import { myRepresentatives } from "../lib/myReps.js";

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);

// The most recent seven days with roll-call votes: what passed, what became law, and every
// recorded vote, with the visitor's representatives' positions if they looked them up.
export default function Week() {
  const [state, setState] = useState({ status: "loading" });
  const [allVotes, setAllVotes] = useState(false);
  const mine = useMemo(() => myRepresentatives(), []);

  useEffect(() => {
    (async () => {
      const { data: last, error: e1 } = await db.from("votes").select("voted_at").order("voted_at", { ascending: false }).limit(1);
      if (e1) throw e1;
      if (!last.length) { setState({ status: "done", votes: [] }); return; }
      const end = new Date(last[0].voted_at);
      const start = new Date(end.getTime() - 6 * DAY);
      const from = iso(start), to = iso(end);
      const cols = "congress,bill_type,number,title,short_title,passed_house_date,passed_senate_date,became_law_date,law_number,vetoed_date";
      const [votes, laws, passed, vetoed] = await Promise.all([
        db.from("votes").select("vote_id,chamber,voted_at,question,description,document_name,result,yea_total,nay_total,source_url,bill_congress,bill_type,bill_number")
          .gte("voted_at", `${from}T00:00:00Z`).order("voted_at", { ascending: false }).limit(500),
        db.from("bills").select(cols).gte("became_law_date", from).lte("became_law_date", to),
        db.from("bills").select(cols).or(`and(passed_house_date.gte.${from},passed_house_date.lte.${to}),and(passed_senate_date.gte.${from},passed_senate_date.lte.${to})`).limit(200),
        db.from("bills").select(cols).gte("vetoed_date", from).lte("vetoed_date", to),
      ]);
      for (const r of [votes, laws, passed, vetoed]) if (r.error) throw r.error;
      let positions = [];
      if (mine.size && votes.data.length) {
        const { data } = await db.from("vote_position_details").select("vote_id,bioguide_id,name,position")
          .in("vote_id", votes.data.map((v) => v.vote_id)).in("bioguide_id", [...mine]);
        positions = data ?? [];
      }
      setState({ status: "done", from, to, votes: votes.data, laws: laws.data, passed: passed.data, vetoed: vetoed.data, positions });
    })().catch(() => setState({ status: "error" }));
  }, [mine]);

  if (state.status === "loading") return <main className="page"><h1>This week in Congress</h1><p>Loading…</p></main>;
  if (state.status === "error") return <main className="page"><h1>This week in Congress</h1><p className="notice">Couldn't load this right now.</p></main>;
  const { votes, laws = [], passed = [], vetoed = [], positions = [] } = state;
  const shown = votes.filter((v) => allVotes || isFinal(v));
  const billLink = (b) => <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link>;
  const passedWhere = (b) => [b.passed_house_date >= state.from && b.passed_house_date <= state.to && `House (${date(b.passed_house_date)})`,
    b.passed_senate_date >= state.from && b.passed_senate_date <= state.to && `Senate (${date(b.passed_senate_date)})`].filter(Boolean).join(" and ");

  return (
    <main className="page wide">
      <h1>This week in Congress</h1>
      {votes.length === 0 ? <p>No votes on record yet.</p> : (
        <>
          <p className="lede">The most recent week with recorded votes: {date(state.from)} to {date(state.to)}.</p>

          <section className="section">
            <h2>Became law</h2>
            {laws.length === 0 ? <p>None this week.</p> : (
              <ul className="plain">{laws.map((b) => <li key={`${b.bill_type}${b.number}`}>{billLink(b)} {b.short_title ?? b.title} · {b.law_number} · signed {date(b.became_law_date)}</li>)}</ul>
            )}
            {vetoed.length > 0 && <p>Vetoed: {vetoed.map((b, i) => <span key={b.number}>{i ? "; " : ""}{billLink(b)} {b.short_title ?? b.title} ({date(b.vetoed_date)})</span>)}</p>}
          </section>

          <section className="section">
            <h2>Passed a chamber</h2>
            {passed.length === 0 ? <p>None this week.</p> : (
              <ul className="plain">{passed.map((b) => <li key={`${b.bill_type}${b.number}`}>{billLink(b)} {b.short_title ?? b.title} <span className="fine">· passed the {passedWhere(b)}</span></li>)}</ul>
            )}
            <p className="fine">Includes bills and resolutions passed by voice vote, which have no roll call.</p>
          </section>

          <section className="section">
            <h2>Roll-call votes</h2>
            <div className="toggle" role="group" aria-label="Which votes to show">
              <button type="button" className={allVotes ? "" : "on"} onClick={() => setAllVotes(false)}>Final votes</button>
              <button type="button" className={allVotes ? "on" : ""} onClick={() => setAllVotes(true)}>All {votes.length} votes</button>
            </div>
            {mine.size === 0 && <p className="fine"><Link to="/">Look up your address</Link> to see how your representatives voted.</p>}
            {shown.length === 0 ? <p>No final votes this week.</p> : (
              <table>
                <thead><tr><th>Date</th><th>Vote</th><th>Result</th>{mine.size > 0 && <th>Your representatives</th>}</tr></thead>
                <tbody>
                  {shown.map((v) => (
                    <tr key={v.vote_id}>
                      <td>{date(v.voted_at)}<div className="fine">{v.chamber === "house" ? "House" : "Senate"}</div></td>
                      <td>
                        <KindLabel v={v} /> <a href={v.source_url}>{v.question}</a>
                        <div className="fine">{v.bill_type ? billLink({ congress: v.bill_congress, bill_type: v.bill_type, number: v.bill_number }) : v.description}</div>
                      </td>
                      <td>{v.result}<div className="fine">{v.yea_total}–{v.nay_total}</div></td>
                      {mine.size > 0 && <td className="fine">{positions.filter((p) => p.vote_id === v.vote_id).map((p) => <div key={p.bioguide_id}><Link to={`/member/${p.bioguide_id}`}>{p.name}</Link>: {p.position}</div>)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <p className="fine">Sources: House Clerk and Senate.gov roll-call records; GovInfo Bill Status (Library of Congress).</p>
        </>
      )}
    </main>
  );
}
