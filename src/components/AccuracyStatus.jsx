import { useEffect, useState } from "react";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";

// The latest weekly accuracy check, with each fact and its source.
export default function AccuracyStatus() {
  const [row, setRow] = useState(null);
  useEffect(() => {
    db.from("accuracy_checks").select("*").order("checked_at", { ascending: false }).limit(1)
      .then(({ data }) => setRow(data?.[0] ?? false));
  }, []);
  if (row === null) return <p>{tr("Loading the latest check…", "Cargando la verificación más reciente…")}</p>;
  if (!row) return <p>{tr("The first check hasn't run yet.", "La primera verificación todavía no se ha hecho.")}</p>;
  return (
    <>
      <p>{tr("Latest check", "Última verificación")}, {date(row.checked_at)}: <strong>{row.matched} {tr("of", "de")} {row.checked}</strong> {tr("facts matched their source.", "datos coincidieron con su fuente.")}</p>
      <details>
        <summary className="fine">{tr("Every fact checked", "Todos los datos verificados")}</summary>
        <table>
          <thead><tr><th>{tr("Fact", "Dato")}</th><th>{tr("This site", "Este sitio")}</th><th>{tr("Source", "Fuente")}</th></tr></thead>
          <tbody>
            {row.details.map((d, i) => (
              <tr key={i}>
                <td>{d.area}: {d.fact}</td>
                <td>{d.ours || "—"}</td>
                <td><a href={d.url}>{d.source || "—"}</a>{!d.ok && <strong> {tr("(differs)", "(difiere)")}</strong>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
