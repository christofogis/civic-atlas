import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { tr } from "../lib/lang.js";

// Wikipedia-style notes. A page lists its notes once, in reading order:
//
//   const NOTES = [{ id: "mts", text: <>Monthly Treasury Statement… <a href=…>…</a></> }, …];
//   <NotesProvider notes={NOTES}> … figure<Ref id="mts" /> … <NotesList /> </NotesProvider>
//
// <Ref> shows a superscript number; tapping it opens the note in place (no jump), with a link
// down to the full list. <NotesList> is the "Notes and sources" section at the bottom, each
// note linking back up to where it is cited. Short caveats that change how a number reads stay
// in the text; notes hold sources, dates checked and longer explanations.
const Ctx = createContext(null);

export function NotesProvider({ notes, children }) {
  const list = notes.filter(Boolean);
  return <Ctx.Provider value={list}>{children}</Ctx.Provider>;
}

// Whether the page's notes include this id (so a shared component can cite it instead of
// printing its own source line).
export function useHasNote(id) {
  const notes = useContext(Ctx);
  return Boolean(notes?.some((n) => n.id === id));
}

export function Ref({ id }) {
  const notes = useContext(Ctx);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const uid = useId();
  const i = notes?.findIndex((n) => n.id === id) ?? -1;
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);
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
          <span className="ref-pop-n">{n}.</span> {notes[i].text}
          <a className="ref-pop-all" href={`#note-${id}`} onClick={() => setOpen(false)}>{tr("All notes", "Todas las notas")}</a>
        </span>
      )}
    </span>
  );
}

export function NotesList({ title }) {
  const notes = useContext(Ctx);
  if (!notes?.length) return null;
  return (
    <section className="notes-list" aria-labelledby="notes-h">
      <h2 id="notes-h">{title ?? tr("Notes and sources", "Notas y fuentes")}</h2>
      <ol>
        {notes.map((note) => (
          <li key={note.id} id={`note-${note.id}`}>
            <a className="note-back" href={`#ref-${note.id}`} aria-label={tr("Back to where this note is used", "Volver a donde se usa esta nota")}>^</a>{" "}
            {note.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
