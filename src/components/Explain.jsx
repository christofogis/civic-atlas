import { useState } from "react";
import { GLOSSARY } from "../lib/glossary.js";
import { voteKind, positionMeaning } from "../lib/voteKind.js";
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
