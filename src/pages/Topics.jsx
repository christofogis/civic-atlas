import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { ordinal } from "../lib/format.js";
import { topicSlug, areaName } from "../lib/policyAreas.js";
import { congressOn, congressYears } from "../../lib/congress.js";
import { Explain } from "../components/Explain.jsx";
import { tr } from "../lib/lang.js";

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
      <h1>{tr("Topics", "Temas")}</h1>
      <p className="lede">{tr("What Congress has worked on, by subject. Each bill has one ", "En qué ha trabajado el Congreso, por tema. Cada proyecto tiene un ")}<Explain id="policy-area">{tr("policy area", "área de política")}</Explain>.</p>
      <div className="filters">
        <label>{tr("Congress", "Congreso")}{" "}
          <select value={congress} onChange={(e) => setParams({ congress: e.target.value })}>
            {Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i).map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
          </select>
        </label>
      </div>
      {!rows ? <p>{tr("Loading…", "Cargando…")}</p> : (
        <table>
          <thead><tr><th>{tr("Topic", "Tema")}</th><th>{tr("Bills introduced", "Proyectos presentados")}</th><th>{tr("Passed a chamber", "Aprobados por una cámara")}</th><th>{tr("Became law", "Se convirtieron en ley")}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.policy_area}>
                <td><Link to={`/topic/${topicSlug(r.policy_area)}?congress=${congress}`}>{areaName(r.policy_area)}</Link></td>
                <td>{r.bills.toLocaleString()}</td>
                <td>{r.passed_any.toLocaleString()}</td>
                <td>{r.laws.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="fine">{tr('Source: GovInfo Bill Status (Library of Congress). Bills and resolutions; "passed a chamber" includes resolutions agreed to.', 'Fuente: GovInfo Bill Status (Biblioteca del Congreso). Proyectos y resoluciones; "aprobados por una cámara" incluye resoluciones adoptadas.')}</p>
    </main>
  );
}
