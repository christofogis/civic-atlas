import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { STATE_NAMES, stateName, seatLabel, date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { PartyName } from "../components/PartyTag.jsx";
import { NotesList, Ref } from "../components/Notes.jsx";
import { myRepresentatives } from "../lib/myReps.js";
import { generalElectionDate, nextElectionYear, onBallot, senateClassFor, isGubernatorialYear, localOnBallot, yearOfLabel } from "../../lib/upForElection.js";

// Which seats are on the ballot in a given general-election year, and who holds each one now.
// Worked out from term end dates, not from who is running: a seat on the ballot may have no
// incumbent in the race. Candidates who have filed are on the Elections page.
const todayLA = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

export default function UpForElection() {
  const [params, setParams] = useSearchParams();
  const today = todayLA();
  const first = nextElectionYear(today);
  const years = [first - 2, first, first + 2, first + 4];
  const year = Number(params.get("year")) || first;
  const state = (params.get("state") ?? "").toUpperCase();
  const [seats, setSeats] = useState(null);
  const [local, setLocal] = useState(null);
  const mine = useMemo(() => myRepresentatives(), []);

  useEffect(() => {
    Promise.all([
      db.from("seat_holders").select("bioguide_id,chamber,state,district,senate_class,party,start_date,end_date,how,seat_status"),
      db.from("member_directory").select("bioguide_id,name"),
    ]).then(([s, m]) => {
      if (s.error || m.error) return setSeats(false);
      const names = new Map((m.data ?? []).map((x) => [x.bioguide_id, x.name]));
      setSeats((s.data ?? []).map((x) => ({ ...x, name: names.get(x.bioguide_id) })));
    });
    fetch("/data/local/ca-orange.json").then((r) => r.json()).then(setLocal).catch(() => setLocal(false));
  }, []);

  const set = (patch) => setParams(Object.fromEntries(Object.entries({ year, state, ...patch }).filter(([, v]) => v)));
  const held = generalElectionDate(year) < today;
  const byState = (a, z) => (STATE_NAMES[a.state] ?? a.state).localeCompare(STATE_NAMES[z.state] ?? z.state) || (a.district ?? 0) - (z.district ?? 0);
  const senate = (seats || []).filter((x) => x.chamber === "senate" && x.seat_status === "serving" && onBallot(x, year)).sort(byState);
  const house = (seats || []).filter((x) => x.chamber === "house" && x.seat_status === "serving" && onBallot(x, year)).sort(byState);
  const houseShown = state ? house.filter((x) => x.state === state) : house;
  const yours = [...senate, ...house].filter((x) => mine.has(x.bioguide_id));
  const supervisors = (local?.supervisors ?? []).filter((s) => localOnBallot(s.term_end, year));
  const councils = (local?.cities ?? []).map((c) => ({ ...c, up: (c.members ?? []).filter((m) => yearOfLabel(m.term_end_label) === year) })).filter((c) => c.up.length);

  const Holder = ({ x }) => (
    <>{x.name ? <Link to={`/member/${x.bioguide_id}`}>{x.name}</Link> : x.bioguide_id} <PartyName party={x.party} />
      {x.how === "appointment" && <span className="fine"> · {tr("appointed", "designado(a)")}</span>}</>
  );

  return (
    <main className="page wide">
      <h1>{tr(`On the ballot in ${year}`, `En la boleta en ${year}`)}<Ref id="src" text={<>{tr("Worked out from each official's term end date: Congress from the official member list (unitedstates/congress-legislators), Orange County from the Clerk of the Board and city websites. California's election cycles are set by the state constitution.", "Calculado a partir de la fecha de fin del período de cada funcionario: el Congreso según la lista oficial de miembros (unitedstates/congress-legislators) y el Condado de Orange según la Secretaría de la Junta y los sitios de las ciudades. Los ciclos electorales de California los fija la constitución del estado.")}</>} /></h1>
      <p className="lede">
        {held
          ? tr(`The general election was held on ${date(generalElectionDate(year))}. These seats were on the ballot; the people listed hold them until the new terms begin.`, `La elección general se celebró el ${date(generalElectionDate(year))}. Estos escaños estuvieron en la boleta; las personas indicadas los ocupan hasta que comiencen los nuevos períodos.`)
          : tr(`General election: ${date(generalElectionDate(year))}. These seats are on the ballot, listed with who holds them now. A seat on the ballot doesn't mean its holder is running.`, `Elección general: ${date(generalElectionDate(year))}. Estos escaños están en la boleta, con quién los ocupa ahora. Que un escaño esté en la boleta no significa que su titular se presente.`)}
      </p>
      <div className="tabs" role="group" aria-label={tr("Election year", "Año de la elección")}>
        {years.map((y) => <button key={y} type="button" className={y === year ? "on" : ""} aria-pressed={y === year} onClick={() => set({ year: y, state: "" })}>{y}</button>)}
      </div>

      {seats === false ? <p className="notice">{tr("Couldn't load seats right now.", "No se pudieron cargar los escaños en este momento.")}</p> : !seats ? <p>{tr("Loading…", "Cargando…")}</p> : (
        <>
          {yours.length > 0 && (
            <section className="section">
              <h2>{tr("Your members of Congress", "Sus miembros del Congreso")}</h2>
              <ul className="plain">{yours.map((x) => <li key={x.bioguide_id}>{seatLabel(x)}: <Holder x={x} /></li>)}</ul>
            </section>
          )}

          <section className="section">
            <h2>{tr(`U.S. Senate: ${senate.length} seats`, `Senado de EE. UU.: ${senate.length} escaños`)}</h2>
            <p className="fine">{tr(`Senators serve six-year terms; about a third of the seats (class ${senateClassFor(year)}) are on each ballot. A seat filled by appointment can also be on the ballot in a special election.`, `Los senadores tienen períodos de seis años; cerca de un tercio de los escaños (clase ${senateClassFor(year)}) está en cada boleta. Un escaño ocupado por designación también puede estar en la boleta en una elección especial.`)}</p>
            {senate.length === 0 ? <p>{tr("No current senator's term ends after this election. The seats will be listed once the senators elected before it take office.", "El período de ningún senador actual termina después de esta elección. Los escaños se mostrarán cuando asuman los senadores elegidos antes.")}</p> : (
              <ul className="plain">{senate.map((x) => <li key={x.bioguide_id}>{stateName(x.state)}: <Holder x={x} />{x.end_date !== `${year + 1}-01-03` && <span className="fine"> · {tr("term ends", "fin del período")} {date(x.end_date)}</span>}</li>)}</ul>
            )}
            <p className="fine"><Link to="/elections">{tr("Candidates who have filed with the FEC", "Candidatos inscritos ante la FEC")}</Link></p>
          </section>

          <section className="section">
            <h2>{tr("U.S. House: every seat", "Cámara de EE. UU.: todos los escaños")}</h2>
            <p className="fine">{tr("All 435 House seats and the delegates' seats are on the ballot every two years.", "Los 435 escaños de la Cámara y los de los delegados están en la boleta cada dos años.")}</p>
            {house.length === 0 ? (
              <p>{tr(`The members whose seats are on the ${year} ballot haven't taken office yet. They'll be listed here once the new Congress begins.`, `Los miembros cuyos escaños estarán en la boleta de ${year} aún no asumen el cargo. Se mostrarán aquí cuando comience el nuevo Congreso.`)}</p>
            ) : (
              <>
                <label>{tr("State", "Estado")}{" "}
                  <select value={state} onChange={(e) => set({ state: e.target.value })}>
                    <option value="">{tr(`All states (${house.length} seats)`, `Todos los estados (${house.length} escaños)`)}</option>
                    {[...new Set(house.map((x) => x.state))].sort((a, z) => stateName(a).localeCompare(stateName(z))).map((s) => <option key={s} value={s}>{stateName(s)}</option>)}
                  </select>
                </label>
                <ul className="plain">{houseShown.map((x) => <li key={x.bioguide_id}>{seatLabel(x)}: <Holder x={x} /></li>)}</ul>
              </>
            )}
          </section>

          <section className="section">
            <h2>{tr("California", "California")}</h2>
            <ul className="plain">
              {isGubernatorialYear(year) && <li>{tr("Governor, Lieutenant Governor, Attorney General, Secretary of State, Controller, Treasurer, Insurance Commissioner, Superintendent of Public Instruction, and the Board of Equalization: four-year terms, elected in these years.", "Gobernador(a), Vicegobernador(a), Procurador(a) General, Secretario(a) de Estado, Contralor(a), Tesorero(a), Comisionado(a) de Seguros, Superintendente de Instrucción Pública y la Junta de Igualación: períodos de cuatro años, elegidos en estos años.")}</li>}
              <li>{tr("State Assembly: all 80 seats, every two years.", "Asamblea estatal: los 80 escaños, cada dos años.")}</li>
              <li>{isGubernatorialYear(year)
                ? tr("State Senate: the 20 even-numbered districts.", "Senado estatal: los 20 distritos con número par.")
                : tr("State Senate: the 20 odd-numbered districts.", "Senado estatal: los 20 distritos con número impar.")}</li>
            </ul>
          </section>

          {local && (supervisors.length > 0 || councils.length > 0) && (
            <section className="section">
              <h2>{tr("Orange County", "Condado de Orange")}</h2>
              {supervisors.length > 0 && (
                <>
                  <h3>{tr("Board of Supervisors", "Junta de Supervisores")}</h3>
                  <ul className="plain">{supervisors.map((s) => <li key={s.district}>{tr(`District ${s.district}`, `Distrito ${s.district}`)}: {s.name} · {tr("term ends", "fin del período")} {date(s.term_end)}</li>)}</ul>
                </>
              )}
              {councils.map((c) => (
                <div key={c.id}>
                  <h3>{tr(`${c.name} City Council`, `Concejo Municipal de ${c.name}`)}</h3>
                  <ul className="plain">{c.up.map((m) => <li key={m.district ?? m.name}>{m.district ? tr(`District ${m.district}`, `Distrito ${m.district}`) : ""}{m.district ? ": " : ""}{m.name}</li>)}</ul>
                </div>
              ))}
              <p className="fine">{tr("County officers and other cities' councils will be added as their term dates are recorded.", "Los funcionarios del condado y los concejos de otras ciudades se agregarán cuando se registren las fechas de sus períodos.")} <a href={local.results_url}>{tr("Orange County Registrar of Voters", "Registro de Votantes del Condado de Orange")}</a></p>
            </section>
          )}
        </>
      )}
      <NotesList />
    </main>
  );
}
