import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";
import { Explain } from "./Explain.jsx";
import { tr } from "../lib/lang.js";

const LISTED = 30;
const readUrl = (v) => v.version_code === "law"
  ? v.xml_url.replace(/\/content\/pkg\/(PLAW-[^/]+)\/.*$/, "/app/details/$1")
  : v.xml_url.replace("/xml/", "/html/").replace(/\.xml$/, ".htm");
const fmt = (n) => Number(n).toLocaleString();
const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? "" : "s"}`;
const where = (s) => [...(s.path ?? []), s.header].join(" › ");

function SectionList({ title, rows, total, extra }) {
  const [all, setAll] = useState(false);
  if (!total) return null;
  const shown = all ? rows : rows.slice(0, LISTED);
  return (
    <>
      <h4>{title} ({fmt(total)})</h4>
      <ul className="plain fine">
        {shown.map((s, i) => <li key={i}>{where(s)}{extra?.(s)}</li>)}
      </ul>
      {rows.length > LISTED && !all && <button type="button" className="link fine" onClick={() => setAll(true)}>{tr(`Show all ${fmt(rows.length)}`, `Mostrar los ${fmt(rows.length)}`)}</button>}
      {total > rows.length && <p className="fine">{tr(`The first ${fmt(rows.length)} are listed.`, `Se listan los primeros ${fmt(rows.length)}.`)}</p>}
    </>
  );
}

// Official text versions of a bill and, between consecutive full texts, which sections changed.
export default function TextVersions({ congress, type, number }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const key = (q) => q.eq("congress", congress).eq("bill_type", type).eq("number", number);
    Promise.all([
      key(db.from("bill_text_versions").select("version_code,seq,version_name,version_date,xml_url,full_text")).order("seq"),
      key(db.from("bill_version_changes").select("*")),
    ]).then(([v, c]) => setData({ versions: v.data ?? [], changes: c.data ?? [] }));
  }, [congress, type, number]);
  if (!data || !data.versions.length) return null;
  const name = Object.fromEntries(data.versions.map((v) => [v.version_code, v.version_name]));
  const changeTo = Object.fromEntries(data.changes.map((c) => [c.to_code, c]));

  return (
    <section className="section">
      <h2>{tr("Text versions", "Versiones del texto")}</h2>
      <p className="fine">{tr("Each ", "Cada ")}<Explain id="text-version">{tr("version", "versión")}</Explain>{tr(" is the official text at that step. Where we could compare a version with the one before it, the changes are listed.", " es el texto oficial en ese paso. Cuando se pudo comparar una versión con la anterior, se listan los cambios.")}</p>
      <ol className="plain versions">
        {data.versions.map((v) => {
          const c = changeTo[v.version_code];
          return (
            <li key={v.version_code}>
              <strong>{v.version_name}</strong>{v.version_date && <> · {date(v.version_date)}</>} · <a href={readUrl(v)}>{tr("Read the text", "Leer el texto (en inglés)")}</a>
              {v.full_text === false && <div className="fine">{tr("Lists only the changes this chamber made, so it isn't compared section by section.", "Solo enumera los cambios que hizo esta cámara, así que no se compara sección por sección.")}</div>}
              {c && (c.added_count + c.removed_count + c.changed_count === 0
                ? <div className="fine">{tr("Compared with", "Comparado con")} {name[c.from_code] ?? c.from_code}: {tr("no section's text changed.", "no cambió el texto de ninguna sección.")}</div>
                : (
                <details>
                  <summary>
                    {tr("Compared with", "Comparado con")} {name[c.from_code] ?? c.from_code}: {tr("sections", "secciones")}{" "}
                    {[c.added_count && tr(`${fmt(c.added_count)} added`, `${fmt(c.added_count)} agregadas`), c.removed_count && tr(`${fmt(c.removed_count)} removed`, `${fmt(c.removed_count)} eliminadas`), c.changed_count && tr(`${fmt(c.changed_count)} changed`, `${fmt(c.changed_count)} modificadas`)].filter(Boolean).join(", ")}
                    {" "}· {fmt(c.words_from)} → {fmt(c.words_to)} {tr("words", "palabras")}
                  </summary>
                  <SectionList title={tr("Added", "Agregadas")} rows={c.added} total={c.added_count} />
                  <SectionList title={tr("Removed", "Eliminadas")} rows={c.removed} total={c.removed_count} />
                  <SectionList title={tr("Changed", "Modificadas")} rows={c.changed} total={c.changed_count}
                    extra={(s) => s.words_to !== s.words_from && <> ({s.words_to > s.words_from ? "+" : "−"}{fmt(Math.abs(s.words_to - s.words_from))} {tr("words", "palabras")})</>} />
                  <p className="fine">{tr(`${plural(c.unchanged_count, "section")} unchanged.`, `${fmt(c.unchanged_count)} ${c.unchanged_count === 1 ? "sección sin cambios" : "secciones sin cambios"}.`)}</p>
                </details>
              ))}
            </li>
          );
        })}
      </ol>
      <p className="fine">
        {tr("Source", "Fuente")}: GovInfo ({tr("Government Publishing Office", "Oficina de Publicaciones del Gobierno")}). <Link to="/methods#text-versions">{tr("How the comparison works", "Cómo funciona la comparación")}</Link>.{" "}
        {tr("Comparisons are computed automatically by matching section headings: they show where the text changed, not what a change does, so read the text for that. A renamed section counts as one removed and one added; renumbering alone isn't counted.",
          "Las comparaciones se calculan automáticamente emparejando los títulos de las secciones: muestran dónde cambió el texto, no qué efecto tiene un cambio; para eso, lea el texto. Una sección con nuevo título cuenta como una eliminada y una agregada; un simple cambio de numeración no cuenta.")}
      </p>
    </section>
  );
}
