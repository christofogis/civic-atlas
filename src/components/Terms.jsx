import { useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { GLOSSARY } from "../lib/glossary.js";
import { markTerms } from "../lib/terms.js";
import { useLang, tr } from "../lib/i18n.jsx";
import { usePop } from "./Explain.jsx";

// One glossary term inside a text, as a small dotted-underline button that opens its definition.
// The word stays as printed (records keep their lang="en"); the definition follows the site's
// language, so the pop-up carries its own lang.
export function Term({ id, children }) {
  const [open, setOpen, ref, trigger, close] = usePop();
  const { t, lang } = useLang();
  const g = GLOSSARY[id];
  // Fixed to the screen under the word, so a clamped ("more") text box can't cut the card off.
  // Runs after usePop's own placement, and again on scroll or resize.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const pop = ref.current?.querySelector(".term-pop");
      const btn = trigger.current;
      if (!pop || !btn) return;
      const r = btn.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const w = pop.offsetWidth;
      pop.style.top = `${Math.round(r.bottom + 6)}px`;
      pop.style.left = `${Math.round(Math.max(12, Math.min(r.left, vw - w - 12)))}px`;
    };
    place();
    window.addEventListener("scroll", place, { passive: true, capture: true });
    window.addEventListener("resize", place);
    return () => { window.removeEventListener("scroll", place, { capture: true }); window.removeEventListener("resize", place); };
  }, [open, ref, trigger]);
  if (!g) return children;
  return (
    <span className="term-wrap" ref={ref}>
      <button type="button" ref={trigger} className="term" aria-expanded={open} onClick={() => setOpen(!open)}>
        {children}<span className="visually-hidden" lang={lang}>{t(" (definition)", " (definición)")}</span>
      </button>
      {open && (
        <span className="explain-pop term-pop" lang={lang}>
          <strong>{t(g.term, g.term_es)}</strong>
          <span>{t(g.text, g.text_es)}</span>
          <Link to={`/glossary#${id}`}>{t("In the glossary", "En el glosario")}</Link>
          <button type="button" className="explain-close" aria-label={t("Close", "Cerrar")} onClick={close}>×</button>
        </span>
      )}
    </span>
  );
}

// A text with its glossary terms marked (first occurrence each). `seen` is shared by the texts of one
// block, so a term marked in the lead isn't marked again in the points; `lang` is the text's language,
// which decides the words looked for.
export function Terms({ text, parts, lang = "en", seen }) {
  const pieces = parts ?? markTerms(text, { lang, seen: seen ?? new Set() });
  return <>{pieces.map((p, i) => (p.id ? <Term key={i} id={p.id}>{p.text}</Term> : p.text))}</>;
}

// A roll call's official question, as the clerk recorded it (in English), with its terms tappable,
// and the official record linked after it. (A term can't be a button inside the record's link.)
export function VoteQuestion({ v }) {
  return (
    <>
      <span lang="en"><Terms text={v.question} lang="en" /></span>
      {v.source_url && <>{" "}<a href={v.source_url} className="fine tap" aria-label={tr("Official record of this vote", "Registro oficial de esta votación (en inglés)")}>{tr("Record", "Registro")}</a></>}
    </>
  );
}
