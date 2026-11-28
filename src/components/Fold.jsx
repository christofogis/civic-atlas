import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { tr } from "../lib/lang.js";

// A topic that opens in place, labeled with a one-line summary of what's inside, so a reader can
// decide whether to open it (usability research: people scan the first lines; labels that say
// what's inside get opened; tabs are often missed on phones). Contents render only when open.
// `count` shows beside the title (how many items are inside); `level` keeps the heading order when a
// fold sits inside a section card (h3 there). Styled as a card with a chevron (styles.css, "Cards").
export function Fold({ id, title, summary, count, level = 2, open, onToggle, status, children }) {
  const H = `h${level}`;
  return (
    <details className="fold" id={id} open={open} onToggle={(e) => onToggle(id, e.currentTarget.open)}>
      <summary>
        <H>{title}{count != null && <span className="fold-count">{count}</span>}</H>
        {summary && <span className="fold-summary">{summary}</span>}
      </summary>
      {open && <div className="fold-body">
        {status === "loading" ? <p className="fine">{tr("Loading…", "Cargando…")}</p>
          : status === "error" ? <p className="notice">{tr("Couldn't load this section. Close and open it to try again.", "No se pudo cargar esta sección. Ciérrela y ábrala para intentarlo de nuevo.")}</p>
          : children}
      </div>}
    </details>
  );
}

// The same component under the name the other pages use for it.
export const Disclosure = Fold;

// Which folds are open. A link to #<id> opens that fold and brings it into view once `ready`.
export function useFolds(ids, ready, resetKey) {
  const [open, setOpen] = useState(() => new Set());
  const { hash } = useLocation();
  const toggle = (id, isOpen) => setOpen((prev) => {
    if (prev.has(id) === isOpen) return prev;
    const next = new Set(prev);
    if (isOpen) next.add(id); else next.delete(id);
    return next;
  });
  useEffect(() => { setOpen(new Set()); }, [resetKey]);
  const target = ids.includes(hash.slice(1)) ? hash.slice(1) : null;
  useEffect(() => {
    if (!target || !ready) return;
    toggle(target, true);
    requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start" }));
  }, [target, ready]);
  // Opens a fold and brings it into view (for a figure or link elsewhere on the page that points at it).
  const reveal = (id) => {
    toggle(id, true);
    requestAnimationFrame(() => { const el = document.getElementById(id); el?.scrollIntoView({ block: "start" }); el?.querySelector("summary")?.focus({ preventScroll: true }); });
  };
  return { open, toggle, reveal };
}
