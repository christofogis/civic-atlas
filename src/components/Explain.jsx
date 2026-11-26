import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GLOSSARY } from "../lib/glossary.js";
import { voteKind, positionMeaning } from "../lib/voteKind.js";
import { voteMeaning } from "../lib/voteMeaning.js";
import { useLang } from "../lib/i18n.jsx";

// Open/close state for a small pop-up that closes on a tap outside or Escape.
function usePop() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  // Keep the card on screen: shift it left if it would run past the right edge.
  useLayoutEffect(() => {
    const pop = open && ref.current?.querySelector(".explain-pop");
    if (!pop) return;
    pop.style.left = "0px";
    const r = pop.getBoundingClientRect();
    const over = r.right - (document.documentElement.clientWidth - 12);
    if (over > 0) pop.style.left = `${-Math.min(over, r.left - 12)}px`;
  }, [open]);
  return [open, setOpen, ref];
}

// A term with an (i) that opens a small pop-up explanation. Tap or click to open; tap outside, press
// Escape or the close button to close. Works on phones, where hover tooltips don't.
export function Explain({ id, children }) {
  const [open, setOpen, ref] = usePop();
  const { t } = useLang();
  const g = GLOSSARY[id];
  if (!g) return children ?? null;
  return (
    <span className="explain" ref={ref}>
      {children ?? t(g.term, g.term_es)}
      <button type="button" className="explain-i" aria-expanded={open} aria-label={t(`What is "${g.term}"?`, `¿Qué es "${g.term_es}"?`)} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.3" /><circle cx="8" cy="4.9" r="0.95" fill="currentColor" /><rect x="7.25" y="6.9" width="1.5" height="4.8" rx="0.7" fill="currentColor" /></svg>
      </button>
      {open && (
        <span className="explain-pop" role="dialog" aria-label={t(g.term, g.term_es)}>
          <strong>{t(g.term, g.term_es)}</strong>
          <span>{t(g.text, g.text_es)}</span>
          <button type="button" className="explain-close" aria-label={t("Close", "Cerrar")} onClick={() => setOpen(false)}>×</button>
        </span>
      )}
    </span>
  );
}

// The vote-type label on a roll call ("Cloture", "Procedural: rule for debate"), tappable.
export function KindLabel({ v }) {
  const [open, setOpen, ref] = usePop();
  const k = voteKind(v);
  return (
    <span className="explain" ref={ref}>
      <button type="button" className={`kind kind-${k.kind}`} aria-expanded={open} onClick={() => setOpen(!open)}>{k.label}</button>
      {open && <span className="explain-pop" role="dialog" aria-label={k.label}><span>{k.explain}</span>
        <button type="button" className="explain-close" aria-label="Close" onClick={() => setOpen(false)}>×</button></span>}
    </span>
  );
}

// A recorded position with what it meant on this kind of vote: "Yea — to pass it".
export function Position({ v, position }) {
  const meaning = positionMeaning(v, position);
  return <><strong>{position}</strong>{meaning && <span className="position-meaning"> · {meaning}</span>}</>;
}

// One plain sentence on what a Yes vote meant and what the result did, from fixed templates
// (src/lib/voteMeaning.js). Shown first; the official question and result stay beneath it.
// The generic fallback only repeats the official question and result, so it's left out where
// those are already on screen (showFallback for places that don't show the question).
export function VoteMeaning({ v, showFallback = false }) {
  const { lang } = useLang();
  const m = voteMeaning(v, lang);
  if (m.fallback && !showFallback) return null;
  return <div className="vote-meaning">{m.text}</div>;
}
