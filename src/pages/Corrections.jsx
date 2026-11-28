import { Link } from "react-router-dom";
import { date } from "../lib/format.js";
import { tr, getLang } from "../lib/lang.js";
import log from "../../data/corrections/log.json";
import leadership from "../../data/corrections/leadership.json";
import { buildCorrections, commitUrl, ISSUES_URL } from "../../lib/corrections.js";

// Every correction to what this site shows, newest first, from data/corrections/ in the repo (built
// into the page, so it loads with it and needs no database). Also published as /data/corrections.json.
const ENTRIES = buildCorrections(log, leadership);

const AREAS = {
  votes: ["Votes", "Votaciones"], bills: ["Bills", "Proyectos de ley"], money: ["Campaign money", "Dinero de campaña"],
  lobbying: ["Lobbying", "Cabildeo"], members: ["Members of Congress", "Miembros del Congreso"], elections: ["Elections", "Elecciones"],
  state: ["State officials", "Funcionarios estatales"], local: ["Orange County", "Condado de Orange"],
  measures: ["Ballot measures", "Medidas en la boleta"], ai: ["AI summaries", "Resúmenes con IA"], several: ["Several pages", "Varias páginas"],
};
const CAUSES = {
  code: ["our code", "nuestro código"],
  upstream: ["a dataset we read", "un conjunto de datos que leemos"],
  source: ["an error in the official record", "un error en el registro oficial"],
};

export default function Corrections() {
  const lang = getLang() === "es" ? "es" : "en";
  return (
    <main className="page">
      <h1>{tr("Corrections", "Correcciones")}</h1>
      <p className="lede">{tr(
        "Every correction we've made to what this site shows, newest first: what the site showed, what it shows now, the official source, and what caused the error.",
        "Cada corrección que hicimos a lo que muestra este sitio, de la más reciente a la más antigua: qué mostraba el sitio, qué muestra ahora, la fuente oficial y qué causó el error.")}</p>
      <p>
        <strong>{tr("How to report an error:", "Cómo informar un error:")}</strong>{" "}
        {tr("open an issue on ", "abra un caso (issue) en ")}<a href={ISSUES_URL}>GitHub</a>
        {tr(" (public), or use \"Report an error on this page\" at the bottom of any page (private; sends only the page address and your message).",
          " (público), o use \"Informar un error en esta página\" al pie de cualquier página (privado; envía solo la dirección de la página y su mensaje).")}
      </p>
      <p className="fine">{tr(
        "Causes: \"our code\" includes our own AI-written text; \"a dataset we read\" means a public dataset (such as congress-legislators or Open States) differed from the official record; \"an error in the official record\" means the official source itself was later corrected.",
        "Causas: \"nuestro código\" incluye el texto que escribimos con IA; \"un conjunto de datos que leemos\" significa que un conjunto de datos público (como congress-legislators u Open States) no coincidía con el registro oficial; \"un error en el registro oficial\" significa que la propia fuente oficial se corrigió después.")}{" "}
        <a href="/data/corrections.json">{tr("This log as data (JSON)", "Este registro como datos (JSON)")}</a>.
      </p>
      <ul className="bare corrections">
        {ENTRIES.map((c) => (
          <li key={c.id} id={c.id}>
            <p className="fine">{date(c.date)} · {tr(...(AREAS[c.area] ?? [c.area, c.area]))} · {tr("Cause", "Causa")}: {tr(...CAUSES[c.cause])}</p>
            <p><strong>{tr("What the site showed", "Qué mostraba el sitio")}:</strong> {c.shown[lang]}</p>
            <p><strong>{tr("What it shows now", "Qué muestra ahora")}:</strong> {c.now[lang]}{c.page && <> <Link to={c.page}>{tr("See the page", "Ver la página")}</Link></>}</p>
            {c.upstream && (
              <p className="fine">
                <a href={c.upstream.dataset}>congress-legislators</a>:{" "}
                {c.upstream.reported ? <a href={c.upstream.reported}>{tr("reported to the dataset", "informado al conjunto de datos")}</a> : tr("not yet reported to the dataset", "aún no informado al conjunto de datos")}
                {" · "}
                {c.upstream.retired
                  ? tr(`the dataset has had the change since ${date(c.upstream.retired)}, so our correction is no longer applied`, `el conjunto de datos tiene el cambio desde el ${date(c.upstream.retired)}, así que ya no aplicamos nuestra corrección`)
                  : tr("our correction is applied until the dataset has the change", "aplicamos nuestra corrección hasta que el conjunto de datos tenga el cambio")}
              </p>
            )}
            <p className="fine">
              {tr("Official source", "Fuente oficial")}: {c.sources.map((s, i) => <span key={s.url}>{i ? "; " : ""}<a href={s.url}>{s.label}</a></span>)}
              {" · "}{tr(c.commits.length > 1 ? "Changes" : "Change", c.commits.length > 1 ? "Cambios" : "Cambio")}: {c.commits.map((sha, i) => <span key={sha}>{i ? ", " : ""}<a href={commitUrl(sha)}><code>{sha.slice(0, 7)}</code></a></span>)}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
