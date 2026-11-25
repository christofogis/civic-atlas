import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { tr } from "../lib/lang.js";

// Wikipedia-style notes: a numbered superscript where a source or explanation applies, which
// opens the note in place (a card at the bottom of the screen on phones), and a "Notes and
// sources" list at the end of the page, each note linking back up. Short caveats that change how
// a number reads stay in the text; notes hold sources, dates checked and longer explanations.
//
// Two ways to use it:
//   - Listed: <NotesProvider notes={[{ id, text }, …]}> with <Ref id="…" /> where each applies.
//     Numbers follow the list's order (write it in reading order).
//   - Collected: <NotesProvider> with <Ref id="…" text={…} />. Each Ref adds its note as it
//     appears, so pages with tabs list only the notes for what's on screen, numbered in order.
const Ctx = createContext(null);

export function NotesProvider({ notes, children }) {
  const texts = useRef(new Map());
  const counts = useRef(new Map());
  const [ids, setIds] = useState([]);
  const listed = notes ? notes.filter(Boolean) : null;
  const value = listed
    ? { list: listed, textOf: (id) => listed.find((n) => n.id === id)?.text }
    : {
        list: ids.map((id) => ({ id })),
        textOf: (id) => texts.current.get(id),
        // Called while each Ref renders, so the list (rendered after them) has current text,
        // e.g. after a language switch.
        setText: (id, text) => texts.current.set(id, text),
        register(id, text) {
          texts.current.set(id, text);
          counts.current.set(id, (counts.current.get(id) ?? 0) + 1);
          setIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
        },
        unregister(id) {
          const n = (counts.current.get(id) ?? 1) - 1;
          counts.current.set(id, n);
          if (n <= 0) setIds((prev) => prev.filter((x) => x !== id));
        },
      };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Whether the page's notes include this id (so a shared component can cite it instead of
// printing its own source line).
export function useHasNote(id) {
  const ctx = useContext(Ctx);
  return Boolean(ctx?.list.some((n) => n.id === id));
}

export function Ref({ id, text }) {
  const ctx = useContext(Ctx);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const uid = useId();
  const collect = Boolean(ctx?.register && text);
  if (collect) ctx.setText(id, text);
  useEffect(() => {
    if (!collect) return undefined;
    ctx.register(id, text);
    return () => ctx.unregister(id);
  }, [collect, id]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  // Outside any provider, a note with text still shows as a plain small line.
  if (!ctx) return text ? <span className="fine ref-inline"> ({text})</span> : null;
  const i = ctx.list.findIndex((n) => n.id === id);
  if (i < 0) return null;
  const n = i + 1;
  return (
    <span className="ref" ref={box}>
      <sup>
        <button type="button" id={`ref-${id}`} className="ref-mark" aria-expanded={open} aria-controls={`${uid}-pop`}
          aria-label={tr(`Note ${n}`, `Nota ${n}`)} onClick={() => setOpen((o) => !o)}>[{n}]</button>
      </sup>
      {open && (
        <span className="ref-pop" id={`${uid}-pop`} role="note">
          <span className="ref-pop-n">{n}.</span> {text ?? ctx.textOf(id)}
          <a className="ref-pop-all" href={`#note-${id}`} onClick={() => setOpen(false)}>{tr("All notes", "Todas las notas")}</a>
        </span>
      )}
    </span>
  );
}

export function NotesList({ title }) {
  const ctx = useContext(Ctx);
  if (!ctx?.list.length) return null;
  return (
    <section className="notes-list" aria-labelledby="notes-h">
      <h2 id="notes-h">{title ?? tr("Notes and sources", "Notas y fuentes")}</h2>
      <ol>
        {ctx.list.map((note) => (
          <li key={note.id} id={`note-${note.id}`}>
            <a className="note-back" href={`#ref-${note.id}`} aria-label={tr("Back to where this note is used", "Volver a donde se usa esta nota")}>^</a>{" "}
            {ctx.textOf(note.id)}
          </li>
        ))}
      </ol>
    </section>
  );
}
