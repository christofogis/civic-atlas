import { useEffect, useState } from "react";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";

// The latest weekly accuracy check, with each fact and its source.
export default function AccuracyStatus() {
  const [row, setRow] = useState(null);
  useEffect(() => {
    db.from("accuracy_checks").select("*").order("checked_at", { ascending: false }).limit(1)
      .then(({ data }) => setRow(data?.[0] ?? false));
  }, []);
  if (row === null) return <p>Loading the latest check…</p>;
  if (!row) return <p>The first check hasn't run yet.</p>;
  return (
    <>
      <p>Latest check, {date(row.checked_at)}: <strong>{row.matched} of {row.checked}</strong> facts matched their source.</p>
      <details>
        <summary className="fine">Every fact checked</summary>
        <table>
          <thead><tr><th>Fact</th><th>This site</th><th>Source</th></tr></thead>
          <tbody>
            {row.details.map((d, i) => (
              <tr key={i}>
                <td>{d.area}: {d.fact}</td>
                <td>{d.ours || "—"}</td>
                <td><a href={d.url}>{d.source || "—"}</a>{!d.ok && <strong> (differs)</strong>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
