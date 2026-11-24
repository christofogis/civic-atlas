import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";

export default function Committees() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    db.from("committees").select("committee_id,name,chamber").is("parent_id", null).order("name")
      .then(({ data, error: e }) => (e ? setError(true) : setRows(data)));
  }, []);

  return (
    <main className="page">
      <h1>Committees</h1>
      {error && <p className="notice">Couldn't load committees right now.</p>}
      {!rows && !error && <p>Loading…</p>}
      {rows && ["senate", "house", "joint"].map((ch) => {
        const list = rows.filter((r) => r.chamber === ch);
        return list.length > 0 && (
          <section key={ch} className="section">
            <h2>{{ senate: "Senate", house: "House", joint: "Joint" }[ch]}</h2>
            <ul className="plain">{list.map((c) => <li key={c.committee_id}><Link to={`/committee/${c.committee_id}`}>{c.name}</Link></li>)}</ul>
          </section>
        );
      })}
      <p className="fine">Source: unitedstates/congress-legislators.</p>
    </main>
  );
}
