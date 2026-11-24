import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { seatLabel, date, money, billLabel, ordinal } from "../lib/format.js";

const BIOGUIDE = /^[A-Z][0-9]{6}$/;

async function loadMember(id) {
  const one = (q) => q.then(({ data, error }) => { if (error) throw error; return data; });
  const [member, terms, seat, memberships, votes, bills, sponsoredCount, cosponsoredCount, finance, freshness] = await Promise.all([
    one(db.from("members").select("*").eq("bioguide_id", id).maybeSingle()),
    one(db.from("terms").select("chamber,state,district,party,start_date,end_date").eq("bioguide_id", id).order("start_date", { ascending: false })),
    one(db.from("seat_holders").select("*").eq("bioguide_id", id).maybeSingle()),
    one(db.from("committee_memberships").select("congress,title,side,rank,committee:committees(committee_id,name,parent_id,url)").eq("bioguide_id", id)),
    one(db.from("votes")
      .select("vote_id,chamber,question,result,voted_at,description,document_name,source_url,vote_positions!inner(position)")
      .eq("vote_positions.bioguide_id", id).order("voted_at", { ascending: false }).limit(15)),
    one(db.from("bills").select("congress,bill_type,number,title,introduced_date,latest_action_date,latest_action_text,source_url")
      .eq("sponsor_bioguide_id", id).order("introduced_date", { ascending: false }).limit(10)),
    db.from("bills").select("*", { count: "exact", head: true }).eq("sponsor_bioguide_id", id).then((r) => r.count),
    db.from("bill_cosponsors").select("*", { count: "exact", head: true }).eq("bioguide_id", id).is("withdrawn_date", null).then((r) => r.count),
    one(db.from("finance_summaries").select("*").eq("bioguide_id", id).order("cycle", { ascending: false })),
    one(db.from("data_freshness").select("*")),
  ]);
  return { member, terms, seat, memberships, votes, bills, sponsoredCount, cosponsoredCount, finance, freshness };
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

export default function Member() {
  const { bioguide } = useParams();
  const [state, setState] = useState({ status: "loading" });

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

  const { member: m, terms, seat, memberships, votes, bills, sponsoredCount, cosponsoredCount, finance, freshness } = state.data;
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
      <p><Link to="/">← Search</Link></p>
      <header>
        <h1>{name}</h1>
        {seat?.seat_status === "serving" ? (
          <p className="lede">{seatLabel(seat)} · {seat.party} · Current term {date(seat.start_date)} – {date(seat.end_date)}</p>
        ) : (
          <p className="lede">Not currently serving. Most recent: {seatLabel(latest)}, {date(latest.start_date)} – {date(latest.end_date)} ({latest.party})</p>
        )}
        <p className="fine">
          <a href={m.source_url}>Biographical Directory of the U.S. Congress</a>
          {seat?.url && <> · <a href={seat.url}>Official website</a></>}
        </p>
      </header>

      <Section title="Service in Congress" source={`unitedstates/congress-legislators.${updated("members")}`}>
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
                {c.committee.url ? <a href={c.committee.url}>{c.committee.name}</a> : c.committee.name}
                {c.title && <> · {c.title}</>}
                {subsByParent(c.committee.committee_id).length > 0 && (
                  <ul>{subsByParent(c.committee.committee_id).map((s) => (
                    <li key={s.committee.committee_id}>{s.committee.name}{s.title && <> · {s.title}</>}</li>
                  ))}</ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent roll-call votes" source={`House Clerk and Senate.gov roll-call records; positions as recorded.${voteJob ? updated(voteJob) : ""}`}>
        {votes.length === 0 ? <p>No roll-call votes on record since 2023.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Question</th><th>Vote</th><th>Result</th></tr></thead>
            <tbody>
              {votes.map((v) => (
                <tr key={v.vote_id}>
                  <td>{date(v.voted_at)}</td>
                  <td>
                    <a href={v.source_url}>{v.question}</a>
                    {(v.document_name || v.description) && <div className="fine">{[v.document_name, v.description].filter(Boolean).join(" · ")}</div>}
                  </td>
                  <td>{v.vote_positions[0]?.position}</td>
                  <td>{v.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Legislation" source={`GovInfo Bill Status (Library of Congress), 118th Congress on.${updated("bills")}`}>
        <p>Sponsored: {sponsoredCount ?? 0} · Cosponsored: {cosponsoredCount ?? 0}</p>
        {bills.length > 0 && (
          <ul className="plain">
            {bills.map((b) => (
              <li key={`${b.congress}-${b.bill_type}-${b.number}`}>
                <a href={b.source_url}>{billLabel(b)}</a> ({ordinal(b.congress)}) · {b.title}
                <div className="fine">Introduced {date(b.introduced_date)}{b.latest_action_text && <> · Latest action {date(b.latest_action_date)}: {b.latest_action_text}</>}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Campaign finance" source={`Federal Election Commission (OpenFEC), totals by two-year cycle.${updated("fec-summaries")}`}>
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
      </Section>
    </main>
  );
}
