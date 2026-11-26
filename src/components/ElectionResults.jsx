import { useEffect, useState } from "react";
import { allResults } from "../lib/results.js";
import { memberRaces, pctText } from "../../lib/electionResults.js";
import { date, stateName } from "../lib/format.js";
import { tr } from "../lib/lang.js";

const TERRITORY_SEAT = { DC: ["Delegate", "Delegado(a)"], PR: ["Resident Commissioner", "Comisionado(a) Residente"], GU: ["Delegate", "Delegado(a)"], VI: ["Delegate", "Delegado(a)"], AS: ["Delegate", "Delegado(a)"], MP: ["Delegate", "Delegado(a)"] };
const n = (v) => (v == null ? "—" : v.toLocaleString());

function raceTitle(r) {
  const kind = r.special ? tr("Special general election", "Elección general especial") : tr("General election", "Elección general");
  const seat = r.office === "S" ? tr("U.S. Senate", "Senado de EE. UU.")
    : TERRITORY_SEAT[r.state] ? tr(...TERRITORY_SEAT[r.state])
    : r.district ? tr(`U.S. House, District ${r.district}`, `Cámara de EE. UU., distrito ${r.district}`)
    : tr("U.S. House, at large", "Cámara de EE. UU., distrito único");
  const term = r.term === "unexpired" ? tr(" (unexpired term)", " (resto del período)") : "";
  return `${date(r.date)} · ${kind}, ${seat}${term}, ${stateName(r.state)}`;
}

// Every general election in the results files where this member was a candidate (matched by FEC
// candidate ID), with every candidate in that race as printed in the source. Same layout for everyone.
export default function ElectionResults({ fecIds }) {
  const [docs, setDocs] = useState(null);
  useEffect(() => { allResults().then(setDocs).catch(() => setDocs(false)); }, []);
  if (docs === false) return <p className="notice">{tr("Couldn't load election results right now.", "No se pudieron cargar los resultados electorales en este momento.")}</p>;
  if (!docs) return <p>{tr("Loading…", "Cargando…")}</p>;
  const list = memberRaces(fecIds, docs);
  const years = docs.map((d) => d.year).sort().join(", ");
  if (!list.length) {
    return <p>{tr(`No general-election result for this member in the published results on file (${years}).`, `No hay resultados de elección general de este miembro en los resultados publicados disponibles (${years}).`)}</p>;
  }
  return (
    <>
      {list.map(({ race: r, candidate: me, source, percent }) => {
        const runoff = r.candidates.some((c) => c.runoff_votes != null);
        const rcv = r.candidates.some((c) => c.rcv_final);
        return (
          <div key={`${r.date}-${r.office}-${r.state}-${r.district}-${r.term}`} className="results-race">
            <h4>{raceTitle(r)}</h4>
            <p>
              {me.votes == null
                ? tr("Unopposed; no vote count in the source.", "Sin oposición; la fuente no da recuento de votos.")
                : <>{tr(`${n(me.votes)} votes (${pctText(me.pct)})`, `${n(me.votes)} votos (${pctText(me.pct)})`)}{me.runoff_votes != null && tr(`; runoff: ${n(me.runoff_votes)} votes (${pctText(me.runoff_pct)})`, `; segunda vuelta: ${n(me.runoff_votes)} votos (${pctText(me.runoff_pct)})`)}.</>}
              {me.note && <span className="fine"> {me.note}</span>}
            </p>
            <div className="table-scroll">
              <table>
                <thead><tr>
                  <th>{tr("Candidate (as printed)", "Candidato(a) (tal como aparece)")}</th>
                  <th>{tr("Party (as printed)", "Partido (tal como aparece)")}</th>
                  <th>{tr("Votes", "Votos")}</th><th>{tr("Percent", "Porcentaje")}</th>
                  {runoff && <th>{tr("Runoff", "Segunda vuelta")}</th>}
                  {rcv && <th>{tr("Final ranked-choice round", "Última ronda de voto preferencial")}</th>}
                </tr></thead>
                <tbody>
                  {r.candidates.map((c, i) => (
                    <tr key={i}>
                      <td>{c === me ? <strong>{c.name}</strong> : c.name}</td>
                      <td>{c.party ?? "—"}{c.lines && <div className="fine">{c.lines.map((x) => `${x.party}: ${n(x.votes)}`).join(" · ")}</div>}</td>
                      <td>{c.votes == null && c.unopposed ? tr("Unopposed", "Sin oposición") : n(c.votes)}</td>
                      <td>{pctText(c.pct) || "—"}</td>
                      {runoff && <td>{c.runoff_votes != null ? `${n(c.runoff_votes)} (${pctText(c.runoff_pct)})` : "—"}</td>}
                      {rcv && <td>{c.rcv_final ? `${n(c.rcv_final.votes)} (${pctText(c.rcv_final.pct)})` : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.not_counted?.length > 0 && (
              <p className="fine">{tr("Also printed, not votes for a candidate and left out of the percent: ", "También aparecen, no son votos por un candidato y no cuentan en el porcentaje: ")}{r.not_counted.map((x) => `${x.label} ${n(x.votes)}`).join("; ")}.</p>
            )}
            {r.ranked_choice && (
              <p className="fine">{rcv
                ? tr("Ranked-choice voting: votes and percent are first choices; the last column is the final round, as printed.", "Voto preferencial: los votos y el porcentaje son primeras preferencias; la última columna es la ronda final, tal como aparece.")
                : tr("Ranked-choice voting: figures as printed in the source.", "Voto preferencial: cifras tal como aparecen en la fuente.")}</p>
            )}
            <p className="fine">
              {tr("Source", "Fuente")}: <a href={source.url}>{source.title}</a> ({source.publisher}){source.retrieved && tr(`, retrieved ${date(source.retrieved)}`, `, consultado el ${date(source.retrieved)}`)}.{" "}
              {percent === "calculated"
                ? tr("This source prints votes only; percent is each line's votes over all votes printed for the race.", "Esta fuente solo da votos; el porcentaje son los votos de cada línea sobre todos los votos de la contienda.")
                : tr("Percent as printed: share of all votes cast in the race.", "Porcentaje tal como aparece: proporción de todos los votos emitidos en la contienda.")}
            </p>
          </div>
        );
      })}
      <p className="fine">{tr(`Results on file: ${years}. Matched to this member by FEC candidate ID.`, `Resultados disponibles: ${years}. Asociados a este miembro por su número de candidato de la FEC.`)}</p>
    </>
  );
}
