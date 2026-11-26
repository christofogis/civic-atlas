import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NotesList, NotesProvider, Ref } from "../components/Notes.jsx";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";

// Statewide ballot measures for California's November 7, 2028 election. Every description on this
// page is the official documents' own wording, copied from their PDFs by scripts/data/measures.mjs:
// the Attorney General's title and summary, the Legislative Analyst's fiscal estimate, the
// Legislative Counsel's Digest. Civic Atlas doesn't summarize or characterize a measure.
const KIND = {
  initiative_constitutional_amendment: ["Initiative constitutional amendment", "Enmienda constitucional por iniciativa"],
  initiative_statute: ["Initiative statute", "Ley por iniciativa"],
  legislative_constitutional_amendment: ["Constitutional amendment placed on the ballot by the Legislature", "Enmienda constitucional puesta en la boleta por la Legislatura"],
  legislative_statute: ["Law placed on the ballot by the Legislature", "Ley puesta en la boleta por la Legislatura"],
  bond: ["Bond measure placed on the ballot by the Legislature", "Medida de bonos puesta en la boleta por la Legislatura"],
};
const EVENT = {
  chaptered: ["Passed by the Legislature and filed with the Secretary of State", "Aprobada por la Legislatura y presentada ante la Secretaría de Estado"],
  cleared_for_circulation: ["Cleared to collect signatures", "Autorizada para recolectar firmas"],
  eligible: ["Enough valid signatures verified; eligible for the ballot", "Firmas válidas suficientes verificadas; elegible para la boleta"],
  certification_due: ["Secretary of State certifies it for the ballot, unless the proponents withdraw it first", "La Secretaría de Estado la certifica para la boleta, salvo que los proponentes la retiren antes"],
};
const today = new Date().toISOString().slice(0, 10);

function Measure({ m }) {
  const qualified = m.status === "qualified";
  return (
    <article className="measure" id={m.id}>
      <p className="seat">{tr(...(KIND[m.kind] ?? [m.kind, m.kind]))} · {m.label}</p>
      <h2>{m.official_title ?? m.title}</h2>
      <p className={`measure-status ${qualified ? "on" : ""}`}>
        {qualified
          ? tr("On the November 7, 2028 ballot", "En la boleta del 7 de noviembre de 2028")
          : tr("Eligible: certified for the ballot on June 29, 2028, unless withdrawn", "Elegible: se certifica para la boleta el 29 de junio de 2028, salvo que se retire")}
      </p>

      {m.official_summary && (
        <section>
          <h3 className="small">{tr("Official summary (Attorney General)", "Resumen oficial (Procurador General)")}</h3>
          {m.official_summary.map((p, i) => <p key={i} className="official" lang="en">{p}</p>)}
        </section>
      )}
      {m.fiscal_estimate && (
        <section>
          <h3 className="small">{tr("Estimated cost to state and local government (Legislative Analyst and Director of Finance)", "Costo estimado para los gobiernos estatal y locales (Analista Legislativo y Director de Finanzas)")}</h3>
          <p className="official" lang="en">{m.fiscal_estimate}</p>
        </section>
      )}
      {m.digest && (
        <section>
          <h3 className="small">{tr("Official summary (Legislative Counsel's Digest)", "Resumen oficial (Resumen del Consejero Legislativo)")}</h3>
          {m.digest.map((p, i) => <p key={i} className="official" lang="en">{p}</p>)}
        </section>
      )}

      <h3 className="small">{tr("Read it yourself", "Léala usted mismo")}</h3>
      <ul className="plain">
        <li><a href={m.text_url} rel="noopener">{tr("Full text (PDF)", "Texto completo (PDF)")}</a></li>
        {m.summary_url && <li><a href={m.summary_url} rel="noopener">{tr("Official title and summary (PDF)", "Título y resumen oficiales (PDF)")}</a></li>}
        {m.analysis_url && <li><a href={m.analysis_url} rel="noopener">{tr("Legislative Analyst's Office analysis", "Análisis de la Oficina del Analista Legislativo")}</a></li>}
      </ul>

      <h3 className="small">{tr("Arguments for and against", "Argumentos a favor y en contra")}</h3>
      <p className="fine">{tr("Each side's official arguments and rebuttals, and the Legislative Analyst's full analysis, are published in the Official Voter Information Guide in the weeks before the election. They'll appear here as written, unedited.",
        "Los argumentos y refutaciones oficiales de cada lado, y el análisis completo del Analista Legislativo, se publican en la Guía Oficial de Información para el Votante en las semanas antes de la elección. Aparecerán aquí tal como están escritos, sin editar.")}</p>

      <h3 className="small">{tr("Who is funding it", "Quién la financia")}</h3>
      <p className="fine">
        {m.funders_url
          ? <><a href={m.funders_url} rel="noopener">{tr("Official top funders of the signature drive (PDF)", "Principales financiadores oficiales de la recolección de firmas (PDF)")}</a>{m.funders_as_of && tr(`, as of ${date(m.funders_as_of)}`, `, al ${date(m.funders_as_of)}`)}. </>
          : null}
        {tr("Campaign committees for and against a measure report contributions to the Secretary of State; totals for each side will be shown here once committees form for this election.",
          "Los comités de campaña a favor y en contra de una medida reportan sus contribuciones a la Secretaría de Estado; los totales de cada lado se mostrarán aquí cuando se formen los comités para esta elección.")}
      </p>

      <h3 className="small">{tr("Path to the ballot", "Camino a la boleta")}</h3>
      <ul className="plain measure-dates">
        {m.dates.map((d) => (
          <li key={d.event} className={d.date > today ? "future" : ""}>
            <span className="fine">{date(d.date)}</span> <a href={d.source} rel="noopener">{tr(...(EVENT[d.event] ?? [d.event, d.event]))}</a>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function Measures() {
  const [data, setData] = useState(null);
  useEffect(() => {
    document.title = tr("California ballot measures, 2028 · Civic Atlas", "Medidas en la boleta de California, 2028 · Civic Atlas");
    fetch("/data/measures/ca-2028.json").then((r) => r.json()).then(setData).catch(() => setData(false));
  }, []);
  const notes = data ? [
    { id: "sources", text: <>{tr(`Sources: California Secretary of State (qualified and eligible measures), Attorney General, Legislative Analyst's Office. Checked against the Secretary of State's lists weekly; last built ${date(data.built)}. `,
      `Fuentes: Secretaría de Estado de California (medidas calificadas y elegibles), Procurador General, Oficina del Analista Legislativo. Se comparan con las listas de la Secretaría de Estado cada semana; última actualización: ${date(data.built)}. `)}
      <a href={data.sources.qualified} rel="noopener">{tr("Qualified measures", "Medidas calificadas")}</a>; <a href={data.sources.eligible} rel="noopener">{tr("Eligible measures", "Medidas elegibles")}</a>.</> },
  ] : [];
  return (
    <NotesProvider notes={notes}>
    <main className="page wide">
      <p className="fine"><Link to="/">{tr("Home", "Inicio")}</Link> / California</p>
      <h1>{tr("California ballot measures, November 7, 2028", "Medidas en la boleta de California, 7 de noviembre de 2028")}<Ref id="sources" /></h1>
      <p className="lede">
        {tr("Statewide measures that voters will decide, so far. Descriptions are the official documents' own words; Civic Atlas doesn't summarize or rate measures. Proposition numbers are assigned in summer 2028.",
          "Medidas estatales que decidirán los votantes, hasta ahora. Las descripciones son las palabras de los documentos oficiales; Civic Atlas no resume ni califica las medidas. Los números de proposición se asignan en el verano de 2028.")}
      </p>
      <p className="fine">{tr("Official text is shown in English, as published. The Secretary of State publishes the voter guide in Spanish and other languages before the election.", "El texto oficial se muestra en inglés, tal como se publicó. La Secretaría de Estado publica la guía para el votante en español y otros idiomas antes de la elección.")}</p>
      {data === false && <p className="notice">{tr("Couldn't load the measures. Try again shortly.", "No se pudieron cargar las medidas. Inténtelo de nuevo en un momento.")}</p>}
      {data && data.measures.map((m) => <Measure key={m.id} m={m} />)}
      <NotesList />
    </main>
    </NotesProvider>
  );
}
