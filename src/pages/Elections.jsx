import { NotesList, Ref } from "../components/Notes.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { STATE_NAMES, stateName, money, date } from "../lib/format.js";
import { tr } from "../lib/lang.js";

// "PADILLA, ALEX" -> "Alex Padilla"; the name as filed is kept in the FEC link's title.
export function displayName(filed) {
  const [last, rest] = String(filed).split(/,\s*/);
  const tc = (s) => (s ?? "").toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, p, c) => p + c.toUpperCase());
  return rest ? `${tc(rest)} ${tc(last)}` : tc(last);
}

export function CandidateRow({ c }) {
  return (
    <tr>
      <td>
        {c.bioguide_id ? <Link to={`/member/${c.bioguide_id}`}>{displayName(c.name)}</Link> : displayName(c.name)}
        {c.incumbent_challenge === "Incumbent" && <span className="fine"> · {tr("incumbent", "en el cargo")}</span>}
      </td>
      <td>{c.party ?? "—"}</td>
      <td>{c.receipts != null ? money(Number(c.receipts)) : <span className="fine">{tr("No reports yet", "Sin informes todavía")}</span>}
        {c.coverage_end_date && <div className="fine">{tr("through", "hasta el")} {date(c.coverage_end_date)}</div>}</td>
      <td><a href={`https://www.fec.gov/data/candidate/${c.fec_candidate_id}/`} title={c.name}>FEC</a></td>
    </tr>
  );
}

export function CandidateTable({ list }) {
  return (
    <table>
      <thead><tr><th>{tr("Candidate", "Candidato(a)")}</th><th>{tr("Party (as filed)", "Partido (según la inscripción)")}</th><th>{tr("Raised, two-year period", "Recaudado, período de dos años")}</th><th>{tr("Filings", "Declaraciones")}</th></tr></thead>
      <tbody>{list.map((c) => <CandidateRow key={c.fec_candidate_id} c={c} />)}</tbody>
    </table>
  );
}

// Who has filed with the FEC to run for Congress in the next election, by state.
export default function Elections() {
  const [params, setParams] = useSearchParams();
  const state = (params.get("state") ?? "").toUpperCase();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    db.from("candidates").select("*").order("election_year", { ascending: false }).order("name").limit(5000)
      .then(({ data }) => setRows(data ?? []));
  }, []);

  const year = rows?.[0]?.election_year;
  const inYear = useMemo(() => (rows ?? []).filter((r) => r.election_year === year), [rows, year]);
  const states = useMemo(() => [...new Set(inYear.map((r) => r.state))].sort((a, z) => (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[z] ?? z)), [inYear]);
  const here = inYear.filter((r) => r.state === state);
  const senate = here.filter((r) => r.office === "S");
  const districts = [...new Set(here.filter((r) => r.office === "H").map((r) => r.district))].sort((a, z) => a - z);

  return (
    <main className="page wide">
      <h1>{year ? tr(`${year} elections: who has filed`, `Elecciones ${year}: quién se ha inscrito`) : tr("Upcoming elections: who has filed", "Próximas elecciones: quién se ha inscrito")}<Ref id="src" text={<>{tr("Source: Federal Election Commission (OpenFEC), updated weekly.", "Fuente: Comisión Federal de Elecciones (OpenFEC), actualizada cada semana.")}</>} /></h1>
      <p className="lede">{tr("Candidates for Congress who have registered with the Federal Election Commission.", "Candidatos al Congreso que se han inscrito ante la Comisión Federal de Elecciones.")}</p>
      <p className="fine">
        {tr(`Anyone can file, and filing doesn't mean a campaign is active; money raised shows which campaigns are reporting activity. Listed alphabetically. House districts are as filed; ${year} House races use the district maps adopted for 2026.`,
          `Cualquiera puede inscribirse, y la inscripción no significa que haya una campaña activa; el dinero recaudado muestra qué campañas informan actividad. En orden alfabético. Los distritos de la Cámara son los indicados en la inscripción; las contiendas de ${year} usan los mapas adoptados para 2026.`)}
      </p>
      {!rows ? <p>{tr("Loading…", "Cargando…")}</p> : inYear.length === 0 ? <p>{tr("No candidates have filed yet.", "Todavía no se ha inscrito ningún candidato.")}</p> : (
        <>
          <div className="filters">
            <label>{tr("State", "Estado")}{" "}
              <select value={state} onChange={(e) => setParams(e.target.value ? { state: e.target.value } : {})}>
                <option value="">{tr("Choose a state", "Elija un estado")}</option>
                {states.map((s) => <option key={s} value={s}>{stateName(s)} ({inYear.filter((r) => r.state === s).length})</option>)}
              </select>
            </label>
          </div>
          {!state && <p>{tr(`${inYear.length} candidates have filed so far in ${states.length} states. Choose a state to see them.`, `Hasta ahora se han inscrito ${inYear.length} candidatos en ${states.length} estados. Elija un estado para verlos.`)}</p>}
          {state && (
            <>
              {senate.length > 0 && (
                <section className="section">
                  <h2>{tr("Senate", "Senado")}</h2>
                  <CandidateTable list={senate} />
                </section>
              )}
              {districts.map((d) => (
                <section className="section" key={d}>
                  <h2>{tr("House", "Cámara")}, {d === 0 ? tr("at-large", "distrito único") : tr(`District ${d}`, `distrito ${d}`)}</h2>
                  <CandidateTable list={here.filter((r) => r.office === "H" && r.district === d)} />
                </section>
              ))}
              {here.length === 0 && <p>{tr(`No candidates have filed in ${stateName(state)} yet.`, `Todavía no se ha inscrito ningún candidato en ${stateName(state)}.`)}</p>}
            </>
          )}
        </>
      )}
      <NotesList />
    </main>
  );
}
