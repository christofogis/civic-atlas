import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";

// Every error found in the site's data or calculations, and what changed.
export default function Corrections() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    db.from("corrections").select("*").order("fixed_on", { ascending: false }).order("id", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <main className="page">
      <h1>Corrections</h1>
      <p className="lede">Every error we've found in this site's data or calculations, and what we changed. Found one? Use "Report an error" at the bottom of any page.</p>
      {!rows ? <p>Loading…</p> : rows.length === 0 ? <p>No corrections yet.</p> : (
        <ul className="bare corrections">
          {rows.map((c) => (
            <li key={c.id}>
              <p className="fine">{date(c.fixed_on)} · {c.area}</p>
              <p><strong>What was wrong:</strong> {c.what_was_wrong}</p>
              <p><strong>What changed:</strong> {c.what_changed}{c.pages && <> <Link to={c.pages}>Example</Link></>}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
