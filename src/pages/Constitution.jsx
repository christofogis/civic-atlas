import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLang } from "../lib/i18n.jsx";
import { date } from "../lib/format.js";
import { markTerms, markBlock } from "../lib/terms.js";
import { matchesQuery, roman } from "../../lib/constitution.js";
import { Terms } from "../components/Terms.jsx";

// The Constitution of the United States, part by part: the verbatim text from the National Archives
// transcriptions (data/constitution/us.json, built to /data/constitution/us.json), an AI summary of
// what each part's words say (shown only once it passed its check against the text), an "Explain it
// simply" version, and links to the official text and to the Constitution Annotated, which explains
// how courts have read each part. Our own words here only label and cross-reference; they never
// characterize a clause.

// Simple local stand-ins for the shared card and disclosure components (night/week); same markup idea,
// so they can be swapped for the shared ones when those land.
function SectionCard({ id, title, children }) {
  return (
    <article className="const-card" id={id} aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`}><a href={`#${id}`} className="const-anchor">{title}</a></h3>
      {children}
    </article>
  );
}
function Disclosure({ summary, defaultOpen = false, className = "", children }) {
  return (
    <details className={`const-disclosure ${className}`} open={defaultOpen || undefined}>
      <summary>{summary}</summary>
      <div className="const-disclosure-body">{children}</div>
    </details>
  );
}

const GROUPS = [
  { id: "preamble", title: ["Preamble", "Preámbulo"] },
  { id: "articles", title: ["Articles", "Artículos"] },
  { id: "bill-of-rights", title: ["Bill of Rights (Amendments I–X)", "Carta de Derechos (Enmiendas I–X)"] },
  { id: "amendments", title: ["Later amendments (XI–XXVII)", "Enmiendas posteriores (XI–XXVII)"] },
];

// A part's AI summary, with the simpler version one tap away. Labeled as AI and checked.
function Summary({ part }) {
  const { t, lang } = useLang();
  const [easy, setEasy] = useState(false);
  const id = useId();
  const s = part.summary;
  if (!s) return <p className="fine const-nosummary">{t("No plain-language summary for this part yet. The original text is below.", "Todavía no hay un resumen en lenguaje sencillo de esta parte. El texto original está abajo.")}</p>;
  const showSimple = easy && !!part.simple;
  const text = showSimple ? part.simple[lang] : s[lang];
  // The summary format: a lead sentence, then "- " lines for each provision.
  const [lead, ...points] = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const [leadParts, ...pointParts] = markBlock([lead, ...points.map((p) => p.replace(/^-\s*/, ""))], lang);
  return (
    <div className="plain-summary const-summary">
      <div lang={lang} id={id} aria-live="polite">
        <p className={`plain-summary-lead${showSimple ? " plain-summary-simple" : ""}`}><Terms parts={leadParts} /></p>
        {pointParts.length > 0 && <ul>{pointParts.map((p, i) => <li key={i}><Terms parts={p} /></li>)}</ul>}
      </div>
      {part.simple && (
        <button type="button" className="link simple-toggle no-print" aria-controls={id} onClick={() => setEasy(!easy)}>
          {showSimple ? t("Show the full summary", "Mostrar el resumen completo") : t("Explain it simply", "Explícalo fácil")}
        </button>
      )}
      <p className="parts-ai-label">
        {showSimple ? t("Simpler AI summary · checked against the text", "Resumen más sencillo hecho por IA · verificado contra el texto")
          : t("Plain-language summary by AI · checked against the text", "Resumen en lenguaje sencillo hecho por IA · verificado contra el texto")}
        {" · "}<Link to="/methods#constitution">{t("How it's made", "Cómo se hace")}</Link>
      </p>
    </div>
  );
}

// One paragraph of the original, with the passage a later amendment changed marked, and glossary
// terms tappable. The words are never changed, only cut into pieces.
function Original({ block, seen }) {
  const passage = block.changes?.find((c) => c.passage)?.passage;
  const pieces = passage && block.text.includes(passage)
    ? [{ text: block.text.slice(0, block.text.indexOf(passage)) }, { text: passage, mark: true }, { text: block.text.slice(block.text.indexOf(passage) + passage.length) }]
    : [{ text: block.text }];
  return pieces.map((p, i) => {
    const t = <Terms key={i} parts={markTerms(p.text, { lang: "en", seen })} />;
    return p.mark ? <mark key={i} className="const-changed">{t}</mark> : t;
  });
}

// The note's amendment name ("Amendment XVI", "Enmienda XVI") becomes the link to that amendment.
function NoteWithLink({ note, target, lang }) {
  const name = target ? `${lang === "es" ? "Enmienda" : "Amendment"} ${roman(target.amendment)}` : null;
  const at = name ? note.indexOf(name) : -1;
  if (at < 0) return note;
  return <>{note.slice(0, at)}<a href={`#${target.id}`}>{name}</a>{note.slice(at + name.length)}</>;
}

function PartCard({ part, byId }) {
  const { t, lang } = useLang();
  const seen = new Set();
  const heading = part.heading[lang] ?? part.heading.en;
  const label = (b) => (b.clause ? t(`Clause ${b.clause}`, `Cláusula ${b.clause}`) : b.section ? t(`Section ${b.section}`, `Sección ${b.section}`) : null);
  const link = (id) => <a href={`#${id}`}>{byId.get(id)?.heading[lang] ?? id}</a>;
  const notes = [...(part.changes ?? []).map((c) => ({ c })), ...part.blocks.flatMap((b) => (b.changes ?? []).map((c) => ({ c, b })))];
  return (
    <SectionCard id={part.id} title={heading}>
      {part.kind === "amendment" && (
        <p className="fine const-dates">
          {part.amendment === 27
            ? t(`Proposed by Congress ${date(part.passed)} · ratified ${date(part.ratified)}`, `Propuesta por el Congreso el ${date(part.passed)} · ratificada el ${date(part.ratified)}`)
            : t(`Passed by Congress ${date(part.passed)} · ratified ${date(part.ratified)}`, `Aprobada por el Congreso el ${date(part.passed)} · ratificada el ${date(part.ratified)}`)}
          {part.repealed_by && <> · {t("repealed by", "derogada por")} {link(`amend${part.repealed_by}`)}</>}
        </p>
      )}
      <Summary part={part} />
      {(notes.length > 0 || part.changes_parts?.length > 0) && (
        <ul className="const-notes fine">
          {notes.map(({ c, b }, i) => (
            <li key={i}>
              {b && label(b) && <>{label(b)}: </>}
              <NoteWithLink note={c.note[lang] ?? c.note.en} target={byId.get(c.by)} lang={lang} />
            </li>
          ))}
          {part.changes_parts?.length > 0 && (
            <li>{t("Changed earlier text in", "Cambió texto anterior en")}{" "}
              {part.changes_parts.map((id, i) => <span key={id}>{i > 0 && ", "}{link(id)}</span>)}
              {t(", as the National Archives notes.", ", según los Archivos Nacionales.")}</li>
          )}
        </ul>
      )}
      <Disclosure className="const-original" defaultOpen={!part.summary}
        summary={<>{t("Original text", "Texto original")}{lang === "es" && <span className="fine"> (en inglés)</span>}</>}>
        <div lang="en" className="const-text">
          {part.blocks.map((b, i) => (
            <p key={i}>
              {label(b) && <span className="const-clause" lang={lang}>{label(b)}. </span>}
              <Original block={b} seen={seen} />
            </p>
          ))}
          {part.footnotes?.map((f) => <p key={f} className="fine">{f}</p>)}
        </div>
        {part.id === "art7" && (
          <p className="fine">{t("The transcription continues with a note on words written between the lines of the parchment, the attestation of William Jackson, Secretary, and the signers' names.",
            "La transcripción continúa con una nota sobre palabras escritas entre líneas en el pergamino, la certificación de William Jackson, secretario, y los nombres de los firmantes.")}</p>
        )}
      </Disclosure>
      <p className="const-links fine">
        <a href={part.sources.official} rel="noopener">{t("Official text (National Archives)", "Texto oficial (Archivos Nacionales, en inglés)")}</a>
        {" · "}
        <a href={part.sources.annotated} rel="noopener">{t("Constitution Annotated", "Constitución Anotada (en inglés)")}</a>
        <span className="const-links-why"> — {t("it explains how courts have read this part.", "explica cómo han interpretado los tribunales esta parte.")}</span>
      </p>
    </SectionCard>
  );
}

// Contents: each group, with a short link per part (Article I: 1 2 3 ...).
function Contents({ parts }) {
  const { t, lang } = useLang();
  const articles = [...new Set(parts.filter((p) => p.kind === "article").map((p) => p.article))];
  const amend = (g) => parts.filter((p) => p.group === g);
  return (
    <nav className="const-toc no-print" aria-label={t("Contents", "Contenido")}>
      <h2 className="small">{t("Contents", "Contenido")}</h2>
      <ul className="plain">
        <li><a href="#preamble">{t("Preamble", "Preámbulo")}</a></li>
        {articles.map((a) => {
          const secs = parts.filter((p) => p.kind === "article" && p.article === a);
          return (
            <li key={a}>
              {secs.length === 1 && !secs[0].section
                ? <a href={`#${secs[0].id}`}>{t(`Article ${roman(a)}`, `Artículo ${roman(a)}`)}</a>
                : <>{t(`Article ${roman(a)}`, `Artículo ${roman(a)}`)}<span className="visually-hidden">{t(", sections", ", secciones")}</span>:{" "}
                  {secs.map((p) => <a key={p.id} href={`#${p.id}`} className="const-chip" aria-label={p.heading[lang]}>{p.section}</a>)}</>}
            </li>
          );
        })}
        {[["bill-of-rights", ["Bill of Rights", "Carta de Derechos"]], ["amendments", ["Later amendments", "Enmiendas posteriores"]]].map(([g, title]) => (
          <li key={g}>{t(...title)}:{" "}
            {amend(g).map((p) => <a key={p.id} href={`#${p.id}`} className="const-chip" aria-label={p.heading[lang]}>{roman(p.amendment)}</a>)}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Constitution() {
  const { t, lang } = useLang();
  const [data, setData] = useState(null);
  const [q, setQ] = useState("");
  const { hash } = useLocation();
  useEffect(() => {
    document.title = t("The Constitution · Civic Atlas", "La Constitución · Civic Atlas");
    fetch("/data/constitution/us.json").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setData(false));
  }, []);
  // A link to #amend14 (or any part) brings it into view once the text has loaded.
  useEffect(() => {
    if (!data || !hash) return;
    requestAnimationFrame(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "start" }));
  }, [data, hash]);
  // Printing shows every part's original text: open the disclosures, then put them back.
  const opened = useRef([]);
  useEffect(() => {
    const before = () => { opened.current = [...document.querySelectorAll(".const-disclosure:not([open])")]; opened.current.forEach((d) => { d.open = true; }); };
    const after = () => { opened.current.forEach((d) => { d.open = false; }); opened.current = []; };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => { window.removeEventListener("beforeprint", before); window.removeEventListener("afterprint", after); };
  }, []);

  const byId = useMemo(() => new Map((data?.parts ?? []).map((p) => [p.id, p])), [data]);
  const shown = useMemo(() => (data?.parts ?? []).filter((p) => matchesQuery(p, q, lang)), [data, q, lang]);
  const withSummary = (data?.parts ?? []).filter((p) => p.summary).length;

  return (
    <main className="page constitution">
      <h1>{t("The Constitution of the United States", "La Constitución de los Estados Unidos")}</h1>
      <p className="lede">
        {t("The full text, part by part, with a plain-language summary of what each part's words say. The text is the National Archives transcription, with its original spelling and capitalization. How courts have read each part is explained in the Constitution Annotated, linked from every part.",
          "El texto completo, parte por parte, con un resumen en lenguaje sencillo de lo que dicen las palabras de cada parte. El texto es la transcripción de los Archivos Nacionales, con su ortografía y mayúsculas originales. Cómo han interpretado los tribunales cada parte se explica en la Constitución Anotada, enlazada desde cada parte.")}
      </p>
      {data === false && <p className="notice">{t("Couldn't load the Constitution's text. Try again later, or read it at the National Archives.", "No se pudo cargar el texto de la Constitución. Inténtelo más tarde o léalo en los Archivos Nacionales.")}{" "}
        <a href="https://www.archives.gov/founding-docs/constitution-transcript">archives.gov</a></p>}
      {data === null && <p>{t("Loading…", "Cargando…")}</p>}
      {data && <>
        <p className="fine">
          {t("Summaries are written by AI, describe only what the text says, and are shown only after a second check against the text.",
            "Los resúmenes los escribe una IA, describen solo lo que dice el texto y se muestran solo después de una segunda verificación contra el texto.")}
          {withSummary < data.parts.length && <> {t(`${withSummary} of ${data.parts.length} parts have one so far.`, `${withSummary} de ${data.parts.length} partes tienen uno por ahora.`)}</>}
          {" "}<Link to="/methods#constitution">{t("How it's made", "Cómo se hace")}</Link>
        </p>
        <form role="search" className="const-search no-print" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="const-q">{t("Search the Constitution", "Buscar en la Constitución")}</label>
          <input id="const-q" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("e.g. habeas corpus, vote, Amendment XIV", "p. ej., habeas corpus, voto, Enmienda XIV")} />
          <p className="fine" aria-live="polite">{q.trim() ? t(`${shown.length} of ${data.parts.length} parts match.`, `${shown.length} de ${data.parts.length} partes coinciden.`) : ""}</p>
        </form>
        {!q.trim() && <Contents parts={data.parts} />}
        {GROUPS.map((g) => {
          const parts = shown.filter((p) => p.group === g.id);
          if (!parts.length) return null;
          return (
            <section key={g.id} className="const-group" aria-labelledby={`g-${g.id}`}>
              <h2 id={`g-${g.id}`}>{t(...g.title)}</h2>
              {parts.map((p) => <PartCard key={p.id} part={p} byId={byId} />)}
            </section>
          );
        })}
        {q.trim() && !shown.length && <p className="notice">{t("No part matches. Try fewer words.", "Ninguna parte coincide. Pruebe con menos palabras.")}</p>}
        <p className="fine const-source">
          {t("Text: National Archives transcriptions of the Constitution, the Bill of Rights and Amendments XI–XXVII (public domain). Dates as the National Archives gives them.",
            "Texto: transcripciones de los Archivos Nacionales de la Constitución, la Carta de Derechos y las Enmiendas XI–XXVII (dominio público). Fechas según los Archivos Nacionales.")}{" "}
          <a href={data.sources.constitution}>{t("Constitution", "Constitución")}</a> · <a href={data.sources.billOfRights}>{t("Bill of Rights", "Carta de Derechos")}</a> · <a href={data.sources.amendments}>{t("Amendments XI–XXVII", "Enmiendas XI–XXVII")}</a>
          {data.retrieved && <> · {t(`retrieved ${date(data.retrieved)}`, `obtenido el ${date(data.retrieved)}`)}</>}
        </p>
      </>}
    </main>
  );
}
