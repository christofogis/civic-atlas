import { useEffect, useMemo, useState } from "react";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { sectionsFromXml } from "../../lib/billtext.js";

// Every part of a bill, from its latest official text: the titles and sections in order, each
// section's official heading and length, and its text on request. A search finds the sections
// that mention a word, so any one talking point can be read against the whole bill. Nothing is
// summarized or characterized: headings and text are the bill's own (in English, as published).

const MAX_SHOWN = 300;

export default function BillParts({ congress, type, number }) {
  const [state, setState] = useState({ status: "loading" });
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const { data } = await db.from("bill_text_versions").select("version_code,seq,version_name,version_date,xml_url,full_text")
        .eq("congress", congress).eq("bill_type", type).eq("number", number).order("seq", { ascending: false });
      // The newest bill-format text (a public law's text is the enrolled bill's, in another format),
      // falling back to earlier versions if one can't be split into sections.
      const versions = (data ?? []).filter((x) => x.full_text !== false && /\/xml\/BILLS-/.test(x.xml_url ?? ""));
      for (const v of versions.slice(0, 3)) {
        const res = await fetch(`/api/billxml?u=${encodeURIComponent(v.xml_url)}`);
        if (!res.ok) continue;
        const sections = sectionsFromXml(await res.text());
        if (sections?.length > 1 || (sections?.length === 1 && versions.length === 1)) {
          if (live) setState({ status: "done", v, sections });
          return;
        }
      }
      if (live) setState({ status: "none" });
    })().catch(() => live && setState({ status: "error" }));
    return () => { live = false; };
  }, [congress, type, number]);

  const found = useMemo(() => {
    if (state.status !== "done") return [];
    const term = q.trim().toLowerCase();
    if (term.length < 3) return state.sections;
    return state.sections.filter((s) => `${s.path.join(" ")} ${s.header} ${s.text}`.toLowerCase().includes(term));
  }, [state, q]);

  if (state.status === "loading") return <p>{tr("Reading the bill's official text…", "Leyendo el texto oficial del proyecto…")}</p>;
  if (state.status === "none") return <p>{tr("The official text isn't available as a document with sections yet.", "El texto oficial aún no está disponible como documento con secciones.")}</p>;
  if (state.status === "error") return <p className="notice">{tr("The official text didn't load. Try again later, or read it on GovInfo from Text versions.", "El texto oficial no se cargó. Intente más tarde o léalo en GovInfo desde Versiones del texto.")}</p>;

  const { v, sections } = state;
  const total = sections.reduce((n, s) => n + s.words, 0);
  const max = Math.max(...sections.map((s) => s.words), 1);
  const tops = [...new Set(sections.map((s) => s.path[0]).filter(Boolean))];
  const shown = found.slice(0, MAX_SHOWN);
  let lastPath = null;

  return (
    <div className="bill-parts">
      <p>
        {tr(`${sections.length} section${sections.length === 1 ? "" : "s"}`, `${sections.length} sección${sections.length === 1 ? "" : "es"}`)}
        {tops.length > 1 && tr(` in ${tops.length} titles or divisions`, ` en ${tops.length} títulos o divisiones`)}
        {tr(`, about ${total.toLocaleString()} words. `, `, unas ${total.toLocaleString("es")} palabras. `)}
        <span className="fine">{tr(`From the version "${v.version_name}"${v.version_date ? `, ${date(v.version_date)}` : ""}. Headings and text are the bill's own, in English.`, `De la versión "${v.version_name}"${v.version_date ? `, ${date(v.version_date)}` : ""}. Los encabezados y el texto son los del proyecto, en inglés.`)}</span>
      </p>
      {tops.length > 1 && (
        <ul className="plain parts-overview" aria-label={tr("The bill's titles or divisions, by share of its words", "Los títulos o divisiones del proyecto, por proporción de palabras")}>
          {tops.map((t) => {
            const in_ = sections.filter((x) => x.path[0] === t);
            const w = in_.reduce((n, x) => n + x.words, 0);
            const pct = Math.round((100 * w) / total);
            return (
              <li key={t}>
                <button type="button" className="link" onClick={() => setQ(t)} lang="en">{t}</button>
                <span className="parts-len"><span style={{ width: `${Math.max(2, pct)}%` }} /></span>
                <span className="fine">{tr(`${in_.length} sec. · ${pct < 1 ? "<1" : pct}%`, `${in_.length} secc. · ${pct < 1 ? "<1" : pct}%`)}</span>
              </li>
            );
          })}
        </ul>
      )}
      <label className="parts-search">
        <span>{tr("Find the parts that mention a word", "Buscar las partes que mencionan una palabra")}</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("e.g. Medicaid, tariff, veterans", "p. ej. Medicaid, tariff, veterans")} />
      </label>
      {q.trim().length >= 3 && (
        <p className="fine">{tr(`${found.length} of ${sections.length} sections mention "${q.trim()}".`, `${found.length} de ${sections.length} secciones mencionan "${q.trim()}".`)}</p>
      )}
      <ol className="parts-list">
        {shown.map((s) => {
          const path = s.path.join(" › ");
          const head = path && path !== lastPath ? <li className="parts-path" key={`p-${s.key}`} aria-hidden="true">{path}</li> : null;
          lastPath = path;
          const isOpen = openKey === s.key;
          return [head, (
            <li key={s.key} className="parts-section">
              <button type="button" className="parts-head" aria-expanded={isOpen} onClick={() => setOpenKey(isOpen ? null : s.key)}>
                <span lang="en">{s.header}</span>
                <span className="parts-len" aria-label={tr(`${s.words} words`, `${s.words} palabras`)}>
                  <span style={{ width: `${Math.max(2, (100 * s.words) / max)}%` }} />
                </span>
                <span className="fine">{s.words.toLocaleString()}</span>
              </button>
              {isOpen && <p className="parts-text" lang="en">{s.text}</p>}
            </li>
          )];
        })}
      </ol>
      {found.length > MAX_SHOWN && <p className="fine">{tr(`Showing the first ${MAX_SHOWN} of ${found.length}. Search to narrow the list.`, `Se muestran las primeras ${MAX_SHOWN} de ${found.length}. Busque para reducir la lista.`)}</p>}
    </div>
  );
}
