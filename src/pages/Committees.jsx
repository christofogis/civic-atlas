import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { tr } from "../lib/lang.js";

export default function Committees() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    db.from("committees").select("committee_id,name,chamber").is("parent_id", null).order("name")
      .then(({ data, error: e }) => (e ? setError(true) : setRows(data)));
  }, []);

  return (
    <main className="page">
      <h1>{tr("Committees", "Comités")}</h1>
      {error && <p className="notice">{tr("Couldn't load committees right now.", "No se pudieron cargar los comités en este momento.")}</p>}
      {!rows && !error && <p>{tr("Loading…", "Cargando…")}</p>}
      {rows && ["senate", "house", "joint"].map((ch) => {
        const list = rows.filter((r) => r.chamber === ch);
        return list.length > 0 && (
          <section key={ch} className="section">
            <h2>{{ senate: tr("Senate", "Senado"), house: tr("House", "Cámara de Representantes"), joint: tr("Joint", "Conjuntos") }[ch]}</h2>
            <ul className="plain">{list.map((c) => <li key={c.committee_id}><Link to={`/committee/${c.committee_id}`}>{c.name}</Link></li>)}</ul>
          </section>
        );
      })}
      <p className="fine">{tr("Source", "Fuente")}: unitedstates/congress-legislators.</p>
    </main>
  );
}
