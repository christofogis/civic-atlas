import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { ordinal } from "../lib/format.js";
import { topicSlug } from "../lib/policyAreas.js";
import { congressOn, congressYears } from "../../lib/congress.js";
import { Explain } from "../components/Explain.jsx";

const CURRENT = congressOn();

export default function Topics() {
  const [params, setParams] = useSearchParams();
  const congress = Number(params.get("congress")) || CURRENT;
  const [rows, setRows] = useState(null);

  useEffect(() => {
    db.from("topic_stats").select("*").eq("congress", congress).order("bills", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, [congress]);

  return (
    <main className="page wide">
      <h1>Topics</h1>
      <p className="lede">What Congress has worked on, by subject. Each bill has one <Explain id="policy-area">policy area</Explain>.</p>
      <div className="filters">
        <label>Congress{" "}
          <select value={congress} onChange={(e) => setParams({ congress: e.target.value })}>
            {Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i).map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
          </select>
        </label>
      </div>
      {!rows ? <p>Loading…</p> : (
        <table>
          <thead><tr><th>Topic</th><th>Bills introduced</th><th>Passed a chamber</th><th>Became law</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.policy_area}>
                <td><Link to={`/topic/${topicSlug(r.policy_area)}?congress=${congress}`}>{r.policy_area}</Link></td>
                <td>{r.bills.toLocaleString()}</td>
                <td>{r.passed_any.toLocaleString()}</td>
                <td>{r.laws.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="fine">Source: GovInfo Bill Status (Library of Congress). Bills and resolutions; "passed a chamber" includes resolutions agreed to.</p>
    </main>
  );
}
