import { NotesList, Ref } from "../components/Notes.jsx";
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
  const [prior, setPrior] = useState(null);
  // The prior Congress's totals, for comparison (coverage starts with the 118th).
  const prev = congress - 1 >= 118 ? congress - 1 : null;

  useEffect(() => {
    setRows(null); setPrior(null);
    db.from("topic_stats").select("*").eq("congress", congress).order("bills", { ascending: false })
      .then(({ data }) => setRows(data ?? []));
    if (prev) db.from("topic_stats").select("bills,passed_any,laws").eq("congress", prev).then(({ data }) => setPrior(data ?? []));
  }, [congress]);

  const total = (list) => list.reduce((t, r) => ({ bills: t.bills + r.bills, passed_any: t.passed_any + r.passed_any, laws: t.laws + r.laws }), { bills: 0, passed_any: 0, laws: 0 });
  // Share of bills and resolutions introduced that became law; one decimal so small shares don't read as 0%.
  const pctLaw = (r) => (r.bills ? `${((100 * r.laws) / r.bills).toFixed(1)}%` : "–");
  const inSession = congress === CURRENT;
  const endYear = 1789 + 2 * (congress - 1) + 2;

  return (
    <main className="page wide">
      <h1>{tr("Topics", "Temas")}<Ref id="src" text={<>{tr('Source: GovInfo Bill Status (Library of Congress). Bills and resolutions; "passed a chamber" includes resolutions agreed to.', 'Fuente: GovInfo Bill Status (Biblioteca del Congreso). Proyectos y resoluciones; "aprobados por una cámara" incluye resoluciones adoptadas.')}</>} /></h1>
      <p className="lede">{tr("What Congress has worked on, by subject. Each bill has one ", "En qué ha trabajado el Congreso, por tema. Cada proyecto tiene un ")}<Explain id="policy-area">{tr("policy area", "área de política")}</Explain>.</p>
      <div className="filters">
        <label>{tr("Congress", "Congreso")}{" "}
          <select value={congress} onChange={(e) => setParams({ congress: e.target.value })}>
            {Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i).map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
          </select>
        </label>
      </div>
      {!rows ? <p>{tr("Loading…", "Cargando…")}</p> : (
        <>
        <table className="topics-table">
          <thead><tr><th>{tr("Topic", "Tema")}</th><th>{tr("Bills introduced", "Proyectos presentados")}</th><th>{tr("Passed a chamber", "Aprobados por una cámara")}</th><th>{tr("Became law", "Se convirtieron en ley")}</th><th>{tr("% became law", "% se convirtió en ley")}<Ref id="pct" text={tr("Bills and resolutions that became law, divided by all bills and resolutions introduced on that topic. Many resolutions (such as simple resolutions of one chamber) can't become law, so this share is lower than the share of bills alone.", "Proyectos y resoluciones que se convirtieron en ley, divididos entre todos los presentados sobre ese tema. Muchas resoluciones (como las resoluciones simples de una cámara) no pueden convertirse en ley, así que esta proporción es menor que la de los proyectos solos.")} /></th></tr></thead>
          <tbody className="topics-totals">
            {prev && prior && (() => { const t = total(prior); return (
              <tr className="prior-row">
                <th scope="row"><Link to={`/topics?congress=${prev}`}>{tr(`All topics, ${ordinal(prev)} Congress (${congressYears(prev)})`, `Todos los temas, ${ordinal(prev)} Congreso (${congressYears(prev)})`)}</Link></th>
                <td>{t.bills.toLocaleString()}</td><td>{t.passed_any.toLocaleString()}</td><td>{t.laws.toLocaleString()}</td><td>{pctLaw(t)}</td>
              </tr>
            ); })()}
            {(() => { const t = total(rows); return (
              <tr className="total-row">
                <th scope="row">{tr(`All topics, ${ordinal(congress)} Congress${inSession ? ", so far" : ""}`, `Todos los temas, ${ordinal(congress)} Congreso${inSession ? ", hasta ahora" : ""}`)}<Ref id="totals" text={tr("Totals add up the topics below. Bills not yet assigned a policy area by the Library of Congress (usually the newest) aren't in any topic, so they aren't counted here.", "Los totales suman los temas de abajo. Los proyectos a los que la Biblioteca del Congreso aún no asigna un área de política (normalmente los más recientes) no están en ningún tema, así que no se cuentan aquí.")} /></th>
                <td>{t.bills.toLocaleString()}</td><td>{t.passed_any.toLocaleString()}</td><td>{t.laws.toLocaleString()}</td><td>{pctLaw(t)}</td>
              </tr>
            ); })()}
          </tbody>
          <tbody>
            {rows.map((r) => (
              <tr key={r.policy_area}>
                <td><Link to={`/topic/${topicSlug(r.policy_area)}?congress=${congress}`}>{areaName(r.policy_area)}</Link></td>
                <td>{r.bills.toLocaleString()}</td>
                <td>{r.passed_any.toLocaleString()}</td>
                <td>{r.laws.toLocaleString()}</td>
                <td>{pctLaw(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {inSession && prev && <p className="fine">{tr(`The ${ordinal(congress)} Congress runs through January 3, ${endYear}, so its counts are still growing; the ${ordinal(prev)} Congress's are final. Bills often pass and become law late in a Congress.`, `El ${ordinal(congress)} Congreso dura hasta el 3 de enero de ${endYear}, así que sus cifras siguen creciendo; las del ${ordinal(prev)} Congreso son definitivas. Los proyectos a menudo se aprueban y se convierten en ley al final de un Congreso.`)}</p>}
        </>
      )}
      <NotesList />
    </main>
  );
}
