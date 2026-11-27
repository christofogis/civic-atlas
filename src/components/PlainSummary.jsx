import { Link } from "react-router-dom";
import { getLang, tr } from "../lib/lang.js";
import { plainKey } from "../lib/plainSummaries.js";

// A bill's AI plain-language summary (from bill_plain_summaries). Always labeled as AI, with the
// official text one tap away; the CRS summary it was checked against sits next to it on the page.
const pick = (row) => {
  const es = getLang() === "es";
  return { lang: es ? "es" : "en", lead: es ? row.lead_es : row.lead_en, points: (es ? row.points_es : row.points_en) ?? [] };
};

export function PlainSummary({ row, bill, crsHref = "#crs-summary" }) {
  if (!row) return null;
  const { lang, lead, points } = pick(row);
  const text = bill?.source_url ? `${bill.source_url}/text` : null;
  return (
    <div className="plain-summary">
      <div lang={lang}>
        <p className="plain-summary-lead">{lead}</p>
        {points.length > 0 && <ul>{points.map((p, i) => <li key={i}>{p}</li>)}</ul>}
      </div>
      <p className="parts-ai-label">
        {tr("Plain-language summary by AI · checked against the ", "Resumen en lenguaje sencillo hecho por IA · verificado contra el ")}
        <a href={crsHref}>{tr("CRS summary", "resumen del CRS")}</a>
        {text && <> · <a href={text}>{tr("Official text", "Texto oficial (en inglés)")}</a></>}
        {" · "}<Link to="/methods#bill-summaries">{tr("How it's made", "Cómo se hace")}</Link>
      </p>
    </div>
  );
}

// The one-line version for lists: the lead under a bill's official title, marked as AI.
export function PlainLead({ map, bill }) {
  if (!bill) return null;
  const row = map?.get(plainKey(bill.congress, bill.bill_type, bill.number));
  if (!row) return null;
  const { lang, lead } = pick(row);
  return (
    <span className="plain-lead">
      <Link to="/methods#bill-summaries" className="ai-tag" title={tr("Plain-language summary by AI, checked against the CRS summary", "Resumen en lenguaje sencillo hecho por IA, verificado contra el resumen del CRS")}
        aria-label={tr("AI summary:", "Resumen por IA:")}>{tr("AI", "IA")}</Link>{" "}
      <span lang={lang}>{lead}</span>
    </span>
  );
}
