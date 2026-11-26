import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { date } from "../lib/format.js";
import { tr, locale } from "../lib/lang.js";

// California's November 3, 2026 results from the Secretary of State, built by scripts/data/ca_results.py.
// Counts, percent, names and party exactly as published. No winner is marked: the SOS doesn't mark one,
// and semi-official counts change until certification.
let cached = null;
export function useCaResults() {
  const [data, setData] = useState(cached);
  useEffect(() => {
    if (cached) return;
    fetch("/data/state/ca-results-2026.json").then((r) => (r.ok ? r.json() : false)).catch(() => false)
      .then((d) => { if (d) cached = d; setData(d); });
  }, []);
  return data;
}

export const OFFICE_TITLES = {
  "governor": ["Governor", "Gobernador(a)"],
  "lieutenant-governor": ["Lieutenant Governor", "Vicegobernador(a)"],
  "secretary-of-state": ["Secretary of State", "Secretario(a) de Estado"],
  "controller": ["Controller", "Contralor(a)"],
  "treasurer": ["Treasurer", "Tesorero(a)"],
  "attorney-general": ["Attorney General", "Procurador(a) General"],
  "insurance-commissioner": ["Insurance Commissioner", "Comisionado(a) de Seguros"],
  "superintendent-of-public-instruction": ["Superintendent of Public Instruction", "Superintendente de Instrucción Pública"],
};

// Party as the SOS prints it, with the site's letter badge: D blue, R red, others grey. A nonpartisan
// office ("Non") gets no badge.
const D = new Set(["Dem", "Democratic"]);
const R = new Set(["Rep", "Republican"]);
function PrintedParty({ party }) {
  if (!party) return null;
  if (party === "Non") return <span className="fine">{tr("Nonpartisan", "No partidista")}</span>;
  const cls = D.has(party) ? "party-d" : R.has(party) ? "party-r" : "party-other";
  const letter = D.has(party) ? "D" : R.has(party) ? "R" : party.slice(0, 1).toUpperCase();
  return <span className="party-name"><span className={`party ${cls}`} aria-hidden="true">{letter}</span> {party}</span>;
}

const pct = (p) => `${p.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const n = (v) => v.toLocaleString(locale());
const when = (iso) => new Date(iso).toLocaleString(locale(), { timeZone: "America/Los_Angeles", dateStyle: "medium", timeStyle: "short" });

// "Semi-official: counting continues, last updated …" or "Certified on …", with the source.
export function ResultsStatus({ data, race }) {
  const certified = data.status === "certified";
  const updated = race?.updated ?? data.updated;
  return (
    <p className="fine results-status">
      {certified
        ? (data.certified_on
          ? tr(`Certified on ${date(data.certified_on)} (Statement of Vote).`, `Certificados el ${date(data.certified_on)} (Declaración del Voto).`)
          : tr("Certified (Statement of Vote).", "Certificados (Declaración del Voto)."))
        : tr(`Semi-official: counting continues. Last updated by the Secretary of State ${updated ? when(updated) : data.updated_text} Pacific time.`,
          `Semioficiales: el conteo continúa. Última actualización de la Secretaría de Estado: ${updated ? when(updated) : data.updated_text}, hora del Pacífico.`)}
      {" "}
      <a href={race?.source_url ?? data.source.url} rel="noopener">{tr("California Secretary of State", "Secretaría de Estado de California")}</a>
      {!certified && <> · <a href={data.source.results_site} rel="noopener">electionresults.sos.ca.gov</a></>}
    </p>
  );
}

// One race: every candidate as listed by the SOS, votes and percent.
export function RaceResult({ race, title, memberLinks = true }) {
  return (
    <div className="race-result">
      {title && <h4>{title}</h4>}
      <table className="results-table">
        <thead><tr><th>{tr("Candidate", "Candidato(a)")}</th><th>{tr("Party (as printed)", "Partido (según la boleta)")}</th><th className="num">{tr("Votes", "Votos")}</th><th className="num">{tr("Percent", "Porcentaje")}</th></tr></thead>
        <tbody>
          {race.candidates.map((c) => (
            <tr key={c.name}>
              <td lang="en">{memberLinks && c.bioguide_id ? <Link to={`/member/${c.bioguide_id}`}>{c.name}</Link> : c.name}</td>
              <td><PrintedParty party={c.party} /></td>
              <td className="num">{n(c.votes)}</td>
              <td className="num">{pct(c.percent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {race.reporting && <p className="fine" lang="en">{race.reporting}</p>}
    </div>
  );
}

// One statewide measure: Yes and No, votes and percent.
export function MeasureResult({ m }) {
  return (
    <div className="race-result">
      <h4>{tr(`Proposition ${m.number}`, `Proposición ${m.number}`)}</h4>
      <p className="official" lang="en">{m.title}</p>
      <table className="results-table">
        <thead><tr><th>{tr("Vote", "Voto")}</th><th className="num">{tr("Votes", "Votos")}</th><th className="num">{tr("Percent", "Porcentaje")}</th></tr></thead>
        <tbody>
          <tr><td>{tr("Yes", "Sí")}</td><td className="num">{n(m.yes_votes)}</td><td className="num">{pct(m.yes_percent)}</td></tr>
          <tr><td>{tr("No", "No")}</td><td className="num">{n(m.no_votes)}</td><td className="num">{pct(m.no_percent)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

export function PartyKey() {
  return (
    <p className="fine">
      {tr("Party as printed by the Secretary of State: Dem = Democratic, Rep = Republican, NPP = No Party Preference. The Superintendent of Public Instruction is a nonpartisan office.",
        "Partido según la Secretaría de Estado: Dem = Demócrata, Rep = Republicano, NPP = Sin preferencia de partido. El cargo de Superintendente de Instrucción Pública no es partidista.")}
      {" "}<Link to="/methods#ca-results">{tr("About these results", "Sobre estos resultados")}</Link>
    </p>
  );
}
