import { useState } from "react";
import { GLOSSARY } from "../lib/glossary.js";
import { voteKind, positionMeaning } from "../lib/voteKind.js";
import { voteMeaning } from "../lib/voteMeaning.js";
import { useLang } from "../lib/i18n.jsx";

// A term with a tap-to-open explanation. Works on phones, where hover tooltips don't.
export function Explain({ id, children }) {
  const [open, setOpen] = useState(false);
  const { t } = useLang();
  const g = GLOSSARY[id];
  if (!g) return children ?? null;
  return (
    <span className="explain">
      <button type="button" className="explain-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
        {children ?? t(g.term, g.term_es)}<span className="explain-i" aria-hidden="true">?</span>
      </button>
      {open && <span className="explain-text" role="note">{t(g.text, g.text_es)}</span>}
    </span>
  );
}

// The vote-type label on a roll call ("Cloture", "Procedural: rule for debate"), tappable.
export function KindLabel({ v }) {
  const [open, setOpen] = useState(false);
  const k = voteKind(v);
  return (
    <>
      <button type="button" className={`kind kind-${k.kind}`} aria-expanded={open} onClick={() => setOpen(!open)}>{k.label}</button>
      {open && <span className="explain-text" role="note">{k.explain}</span>}
    </>
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
