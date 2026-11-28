import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { getLang, tr } from "../lib/lang.js";
import { plainKey } from "../lib/plainSummaries.js";
import { markBlock } from "../lib/terms.js";
import { Terms } from "./Terms.jsx";

// A bill's AI plain-language summary (from bill_plain_summaries). Always labeled as AI, with the
// official text one tap away; the CRS summary it was checked against sits next to it on the page.
const pick = (row) => {
  const es = getLang() === "es";
  return { lang: es ? "es" : "en", lead: es ? row.lead_es : row.lead_en, points: (es ? row.points_es : row.points_en) ?? [] };
};

// `simple`: the simpler version (bill_simple_summaries), when one passed its check. A button swaps
// it in place of the summary and back; the label under it always says which one is shown.
export function PlainSummary({ row, simple, bill, crsHref = "#crs-summary" }) {
  const [easy, setEasy] = useState(false);
  const id = useId();
  if (!row) return null;
  const { lang, lead, points } = pick(row);
  const simpleText = simple ? (lang === "es" ? simple.text_es : simple.text_en) : null;
  const showSimple = easy && !!simpleText;
  const text = bill?.source_url ? `${bill.source_url}/text` : null;
  // Glossary terms are tappable, the first time each appears in what is shown.
  const [leadParts, ...pointParts] = markBlock(showSimple ? [simpleText] : [lead, ...points], lang);
  return (
    <div className="plain-summary">
      {/* Read out when it changes, so a screen-reader user hears the other version after the button. */}
      <div lang={lang} id={id} aria-live="polite">
        {showSimple
          ? <p className="plain-summary-lead plain-summary-simple"><Terms parts={leadParts} /></p>
          : <>
            <p className="plain-summary-lead"><Terms parts={leadParts} /></p>
            {points.length > 0 && <ul>{pointParts.map((p, i) => <li key={i}><Terms parts={p} /></li>)}</ul>}
          </>}
      </div>
      {simpleText && (
        // The same button stays in place (focus stays on it); its words say what a tap does next.
        <button type="button" className="link simple-toggle" aria-controls={id} onClick={() => setEasy(!easy)}>
          {showSimple ? tr("Show the full summary", "Mostrar el resumen completo") : tr("Explain it simply", "Explícalo fácil")}
        </button>
      )}
      <p className="parts-ai-label">
        {showSimple
          ? <>{tr("Simpler AI summary · checked against the ", "Resumen más sencillo hecho por IA · verificado contra el ")}</>
          : <>{tr("Plain-language summary by AI · checked against the ", "Resumen en lenguaje sencillo hecho por IA · verificado contra el ")}</>}
        <a href={crsHref}>{tr("CRS summary", "resumen del CRS")}</a>
        {text && <> · <a href={text}>{tr("Official text", "Texto oficial (en inglés)")}</a></>}
        {" · "}<Link to={showSimple ? "/methods#simple-summaries" : "/methods#bill-summaries"}>{tr("How it's made", "Cómo se hace")}</Link>
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
        aria-label={tr("AI summary: how it's made", "Resumen por IA: cómo se hace")}>{tr("AI", "IA")}</Link>{" "}
      <span lang={lang}>{lead}</span>
    </span>
  );
}
