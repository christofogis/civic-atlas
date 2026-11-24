import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { KindLabel } from "../components/Explain.jsx";
import { date, billLabel, ordinal } from "../lib/format.js";
import { voteKind, isFinal } from "../lib/voteKind.js";

const BIOGUIDE = /^[A-Z][0-9]{6}$/;
const PAGE = 50;
const NOMINATIONS = "Nominations";
const NO_BILL = "Other votes (no bill or nominee)";
const COLUMNS = "vote_id,chamber,congress,voted_at,question,description,document_name,result,source_url,position,bill_congress,bill_type,bill_number,policy_area,bill_title";

const isNomination = (v) => /^PN\d/.test(v.document_name ?? "") || voteKind(v).kind === "nomination";
const issueOf = (v) => v.policy_area ?? (isNomination(v) ? NOMINATIONS : NO_BILL);

async function loadVotes(id, congress) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("member_votes").select(COLUMNS)
      .eq("bioguide_id", id).eq("congress", congress)
      .order("voted_at", { ascending: false }).range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

export default function MemberVotes() {
  const { bioguide } = useParams();
  const [params, setParams] = useSearchParams();
  const [member, setMember] = useState(null);
  const [congresses, setCongresses] = useState([]);
  const [state, setState] = useState({ status: "loading" });
  const [shown, setShown] = useState(PAGE);

  const congress = Number(params.get("congress")) || congresses[0];
  const issue = params.get("issue") ?? "";
  const finalOnly = params.get("final") === "1";
  const q = params.get("q") ?? "";
  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
    setShown(PAGE);
  };

  useEffect(() => {
    if (!BIOGUIDE.test(bioguide ?? "")) { setState({ status: "missing" }); return; }
    Promise.all([
      db.from("members").select("bioguide_id,official_full_name,first_name,last_name").eq("bioguide_id", bioguide).maybeSingle(),
      db.from("member_vote_stats").select("congress").eq("bioguide_id", bioguide).order("congress", { ascending: false }),
    ]).then(([m, stats]) => {
      if (m.error || !m.data) { setState({ status: m.error ? "error" : "missing" }); return; }
      setMember(m.data);
      const list = [...new Set((stats.data ?? []).map((s) => s.congress))];
      setCongresses(list);
      if (!list.length) setState({ status: "done", rows: [] });
    }).catch(() => setState({ status: "error" }));
  }, [bioguide]);

  useEffect(() => {
    if (!member || !congress) return;
    setState({ status: "loading" });
    loadVotes(bioguide, congress)
      .then((rows) => setState({ status: "done", rows }))
      .catch(() => setState({ status: "error" }));
  }, [member, bioguide, congress]);

  const rows = state.rows ?? [];
  const issues = useMemo(() => {
    const counts = new Map();
    for (const v of rows) counts.set(issueOf(v), (counts.get(issueOf(v)) ?? 0) + 1);
    const named = [...counts].filter(([k]) => k !== NOMINATIONS && k !== NO_BILL).sort((a, z) => a[0].localeCompare(z[0]));
    return [...named, ...[NOMINATIONS, NO_BILL].filter((k) => counts.has(k)).map((k) => [k, counts.get(k)])];
  }, [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((v) => (!issue || issueOf(v) === issue) && (!finalOnly || isFinal(v)) &&
      (!needle || [v.question, v.description, v.bill_title, v.document_name, v.bill_type && billLabel({ bill_type: v.bill_type, number: v.bill_number })]
        .some((t) => String(t ?? "").toLowerCase().includes(needle))));
  }, [rows, issue, finalOnly, q]);
  const tally = useMemo(() => {
    const t = new Map();
    for (const v of filtered) t.set(v.position, (t.get(v.position) ?? 0) + 1);
    return [...t].sort((a, z) => z[1] - a[1]);
  }, [filtered]);

  if (state.status === "missing") return <main className="page"><h1>Member not found</h1><p><Link to="/">Back to search</Link></p></main>;
  if (state.status === "error") return <main className="page"><p className="notice">Couldn't load votes right now. Try again shortly.</p></main>;
  const name = member ? (member.official_full_name ?? `${member.first_name} ${member.last_name}`) : "";

  return (
    <main className="page wide">
      <p><Link to={`/member/${bioguide}`}>← {name || "Member"}</Link></p>
      <h1>Roll-call votes{name && <>: {name}</>}</h1>
      <p className="fine">
        Issue is the policy area the Library of Congress assigns to the bill a vote was on. Votes on amendments
        and procedural motions count under their bill. <Link to="/methods#vote-issues">How votes are grouped</Link>.
      </p>

      <div className="filters">
        {congresses.length > 1 && (
          <label>Congress{" "}
            <select value={congress ?? ""} onChange={(e) => setParam("congress", e.target.value)}>
              {congresses.map((c) => <option key={c} value={c}>{ordinal(c)}</option>)}
            </select>
          </label>
        )}
        <label>Issue{" "}
          <select value={issue} onChange={(e) => setParam("issue", e.target.value)}>
            <option value="">All issues ({rows.length})</option>
            {issues.map(([k, n]) => <option key={k} value={k}>{k} ({n})</option>)}
          </select>
        </label>
        <label>Search{" "}
          <input type="search" value={q} placeholder="Bill, nominee or keyword" onChange={(e) => setParam("q", e.target.value)} />
        </label>
        <div className="toggle" role="group" aria-label="Which votes to show">
          <button type="button" className={finalOnly ? "" : "on"} onClick={() => setParam("final", "")}>All votes</button>
          <button type="button" className={finalOnly ? "on" : ""} onClick={() => setParam("final", "1")}>Final votes only</button>
        </div>
      </div>

      {state.status === "loading" ? <p>Loading…</p> : (
        <>
          <p>
            {filtered.length.toLocaleString()} vote{filtered.length === 1 ? "" : "s"}
            {tally.length > 0 && <>: {tally.map(([p, n]) => `${p} ${n}`).join(", ")}</>}.
          </p>
          {filtered.length > 0 && (
            <table>
              <thead><tr><th>Date</th><th>Question</th><th>Vote</th><th>Result</th></tr></thead>
              <tbody>
                {filtered.slice(0, shown).map((v) => {
                  return (
                    <tr key={v.vote_id}>
                      <td>{date(v.voted_at)}</td>
                      <td>
                        <KindLabel v={v} />
                        <a href={v.source_url}>{v.question}</a>
                        <div className="fine">
                          {v.bill_type
                            ? <><Link to={`/bill/${v.bill_congress}/${v.bill_type}/${v.bill_number}`}>{billLabel({ bill_type: v.bill_type, number: v.bill_number })}</Link>{v.bill_title && <> · {v.bill_title}</>}{v.policy_area && <> · {v.policy_area}</>}</>
                            : v.description}
                        </div>
                      </td>
                      <td>{v.position}</td>
                      <td>{v.result}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {filtered.length > shown && (
            <p><button className="link" onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, filtered.length - shown)} more</button></p>
          )}
          <p className="fine">Source: House Clerk and Senate.gov roll-call records; positions as recorded. Policy areas: Library of Congress, via GovInfo Bill Status.</p>
        </>
      )}
    </main>
  );
}
