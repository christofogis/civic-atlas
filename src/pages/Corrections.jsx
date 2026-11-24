import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";

// Every error found in the site's data or calculations, and what changed.
export default function Corrections() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    db.from("corrections").select("*").order("fixed_on", { ascending: false }).order("id", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <main className="page">
      <h1>{tr("Corrections", "Correcciones")}</h1>
      <p className="lede">{tr('Every error we\'ve found in this site\'s data or calculations, and what we changed. Found one? Use "Report an error" at the bottom of any page.', 'Cada error que encontramos en los datos o cálculos de este sitio, y lo que cambiamos. ¿Encontró uno? Use "Informar un error" al pie de cualquier página. Las descripciones de cada corrección están en inglés.')}</p>
      {!rows ? <p>{tr("Loading…", "Cargando…")}</p> : rows.length === 0 ? <p>{tr("No corrections yet.", "Todavía no hay correcciones.")}</p> : (
        <ul className="bare corrections">
          {rows.map((c) => (
            <li key={c.id}>
              <p className="fine">{date(c.fixed_on)} · {c.area}</p>
              <p><strong>{tr("What was wrong", "Qué estaba mal")}:</strong> {c.what_was_wrong}</p>
              <p><strong>{tr("What changed", "Qué cambió")}:</strong> {c.what_changed}{c.pages && <> <Link to={c.pages}>{tr("Example", "Ejemplo")}</Link></>}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
