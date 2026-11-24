import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { congressOn, congressYears } from "../../lib/congress.js";
import { billLabel, ordinal, partyTag, date } from "../lib/format.js";

// The Library of Congress's 32 policy areas.
const POLICY_AREAS = [
  "Agriculture and Food", "Animals", "Armed Forces and National Security", "Arts, Culture, Religion",
  "Civil Rights and Liberties, Minority Issues", "Commerce", "Congress", "Crime and Law Enforcement",
  "Economics and Public Finance", "Education", "Emergency Management", "Energy", "Environmental Protection",
  "Families", "Finance and Financial Sector", "Foreign Trade and International Finance",
  "Geographic Areas, Entities, and Committees", "Government Operations and Politics", "Health",
  "Housing and Community Development", "Immigration", "International Affairs", "Labor and Employment", "Law",
  "Native Americans", "Private Legislation", "Public Lands and Natural Resources",
  "Science, Technology, Communications", "Social Sciences and History", "Social Welfare",
  "Sports and Recreation", "Taxation", "Transportation and Public Works", "Water Resources Development",
];
const SORTS = {
  action: { label: "Most recent action", column: "latest_action_date" },
  introduced: { label: "Most recently introduced", column: "introduced_date" },
  lobbying: { label: "Most organizations lobbying", column: "lobbying_clients" },
};
const PAGE = 50;
const CURRENT = congressOn();
// Coverage starts with the 118th Congress.
const CONGRESS_OPTIONS = Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i);

export default function Bills() {
  const [params, setParams] = useSearchParams();
  const congress = Number(params.get("congress")) || CURRENT;
  const issue = params.get("issue") ?? "";
  const sort = SORTS[params.get("sort")] ? params.get("sort") : "action";
  const page = Math.max(0, Number(params.get("page")) || 0);
  const [state, setState] = useState({ status: "loading", rows: [] });
  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== "page") n.delete("page");
    setParams(n);
  };

  useEffect(() => {
    setState((s) => ({ ...s, status: "loading" }));
    // "Most lobbying" reads a view that starts from the per-bill totals (fast); others read all bills.
    let q = db.from(sort === "lobbying" ? "bill_list_lobbied" : "bill_list")
      .select("congress,bill_type,number,title,short_title,introduced_date,latest_action_date,latest_action_text,policy_area,sponsor_bioguide_id,sponsor_name,sponsor_party,sponsor_chamber,sponsor_state,sponsor_district,lobbying_clients")
      .eq("congress", congress);
    if (issue) q = q.eq("policy_area", issue);
    q.order(SORTS[sort].column, { ascending: false, nullsFirst: false }).order("number")
      .range(page * PAGE, page * PAGE + PAGE - 1)
      .then(({ data, error }) => setState(error ? { status: "error", rows: [] } : { status: "done", rows: data }));
  }, [congress, issue, sort, page]);

  return (
    <main className="page wide">
      <h1>Bills</h1>
      <div className="filters">
        <label>Congress{" "}
          <select value={congress} onChange={(e) => set("congress", e.target.value)}>
            {CONGRESS_OPTIONS.map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
          </select>
        </label>
        <label>Issue{" "}
          <select value={issue} onChange={(e) => set("issue", e.target.value)}>
            <option value="">All issues</option>
            {POLICY_AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label>Sort{" "}
          <select value={sort} onChange={(e) => set("sort", e.target.value)}>
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </label>
      </div>
      {state.status === "error" && <p className="notice">Couldn't load bills right now.</p>}
      {state.status === "loading" && state.rows.length === 0 && <p>Loading…</p>}
      {state.rows.length === 0 && state.status === "done" && <p>No bills match.</p>}
      {state.rows.length > 0 && (
        <table className={state.status === "loading" ? "dim" : ""}>
          <thead><tr><th>Bill</th><th>Sponsor</th><th>Latest action</th>{sort === "lobbying" && <th>Lobbying</th>}</tr></thead>
          <tbody>
            {state.rows.map((b) => (
              <tr key={`${b.bill_type}-${b.number}`}>
                <td>
                  <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link> {b.short_title ?? b.title}
                  {b.policy_area && <div className="fine">{b.policy_area}</div>}
                </td>
                <td>{b.sponsor_bioguide_id
                  ? <><Link to={`/member/${b.sponsor_bioguide_id}`}>{b.sponsor_name}</Link>{b.sponsor_party && <> ({partyTag({ party: b.sponsor_party, chamber: b.sponsor_chamber, state: b.sponsor_state, district: b.sponsor_district })})</>}</>
                  : ""}</td>
                <td><span className="fine">{date(b.latest_action_date)}</span><div>{b.latest_action_text}</div></td>
                {sort === "lobbying" && <td>{b.lobbying_clients.toLocaleString()}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="pager">
        {page > 0 && <button className="link" onClick={() => set("page", String(page - 1))}>← Previous</button>}
        {state.rows.length === PAGE && <button className="link" onClick={() => set("page", String(page + 1))}>Next →</button>}
      </p>
      <p className="fine">
        Source: GovInfo Bill Status (Library of Congress); {ordinal(congress)} Congress. Lobbying counts are organizations
        whose LD-2 reports name the bill (<Link to="/methods#lobbying">how they're counted</Link>).
      </p>
    </main>
  );
}
