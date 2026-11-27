import Portrait from "../components/Portrait.jsx";
import { noPhoto } from "../lib/photo.js";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { STATE_NAMES, stateName, seatLabel, date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { PartyName, partyClass } from "../components/PartyTag.jsx";
import { partyName } from "../lib/format.js";
import { NotesList, Ref } from "../components/Notes.jsx";
import { myRepresentatives } from "../lib/myReps.js";
import { useCaResults, ResultsStatus, RaceResult, MeasureResult, PartyKey, OFFICE_TITLES } from "../components/CaResults.jsx";
import { resultsFor } from "../lib/results.js";
import { byElection, electionNameEs } from "../../lib/measures.js";
import { shareOn, pctText } from "../../lib/electionResults.js";
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
  const [measures, setMeasures] = useState(null);
  const mine = useMemo(() => myRepresentatives(), []);
  const caResults = useCaResults();
  // Official results for this year's election, once published (FEC or House Clerk), and each
  // member's FEC candidate IDs to find the seat holder among the candidates.
  const [results, setResults] = useState(null);
  const [fecIds, setFecIds] = useState(null);

  useEffect(() => {
    Promise.all([
      // Every term from early 2025 on: the current holders, the ones whose seats were on a ballot that
      // has passed, and (from the day new terms begin) who holds each seat after that election.
      db.from("terms").select("bioguide_id,chamber,state,district,senate_class,party,start_date,end_date,how").gte("end_date", "2025-01-04"),
      db.from("member_directory").select("bioguide_id,name"),
    ]).then(([s, m]) => {
      if (s.error || m.error) return setSeats(false);
      const names = new Map((m.data ?? []).map((x) => [x.bioguide_id, x.name]));
      setSeats((s.data ?? []).map((x) => ({ ...x, name: names.get(x.bioguide_id) })));
    });
    fetch("/data/local/ca-orange.json").then((r) => r.json()).then(setLocal).catch(() => setLocal(false));
    fetch("/data/measures/ca-2028.json").then((r) => r.json()).then(setMeasures).catch(() => {});
  }, []);

  useEffect(() => {
    let live = true;
    setResults(null);
    resultsFor(year).then((doc) => {
      if (!live || !doc) return;
      setResults(doc);
      if (!fecIds) db.from("members").select("bioguide_id,fec_candidate_ids").then(({ data }) => live && setFecIds(new Map((data ?? []).map((x) => [x.bioguide_id, x.fec_candidate_ids]))));
    }).catch(() => {});
    return () => { live = false; };
  }, [year]);

  const set = (patch) => setParams(Object.fromEntries(Object.entries({ year, state, ...patch }).filter(([, v]) => v)));
  const past = generalElectionDate(year) < today;
  const byState = (a, z) => (STATE_NAMES[a.state] ?? a.state).localeCompare(STATE_NAMES[z.state] ?? z.state) || (a.district ?? 0) - (z.district ?? 0);
  // A Senate seat is on the ballot when its holder's term ends that cycle, or when it belongs to that
  // year's class even though its current holder (an appointee) leaves earlier, after a special election.
  const serving = (x) => x.start_date <= today && today < x.end_date;
  const pastYear = (y) => generalElectionDate(y) < today;
  // For an election that has passed, only those still in office on election day: someone who left
  // earlier (a resignation in the year before) wasn't the holder on that ballot. An appointee's term
  // ends on the day of the special election itself (Ricketts 2024, Moody 2026), so that day counts.
  const onElectionDay = (x, y) => x.start_date <= generalElectionDate(y) && x.end_date >= generalElectionDate(y);
  const one = (list) => [...new Map(list.map((x) => [x.bioguide_id, x])).values()];
  // A Senate seat is on the ballot when its holder's term ends that cycle, or when it belongs to that
  // year's class even though its holder (an appointee) leaves earlier, after a special election. For an
  // election that has passed, the terms that ended with it are listed; otherwise, today's holders.
  const senateIn = (y) => one((seats || []).filter((x) => x.chamber === "senate" && (pastYear(y) ? onElectionDay(x, y) : serving(x)) && (onBallot(x, y) ||
    (x.how === "appointment" && x.senate_class === senateClassFor(y) && nextElectionYear(x.end_date) === y)))).sort(byState);
  const senate = senateIn(year);
  const held = (list) => Object.entries(list.reduce((m, x) => ({ ...m, [x.party]: (m[x.party] ?? 0) + 1 }), {})).sort((a, z) => z[1] - a[1]);
  const house = one((seats || []).filter((x) => x.chamber === "house" && (past ? onElectionDay(x, year) : serving(x)) && onBallot(x, year))).sort(byState);
  const houseShown = state ? house.filter((x) => x.state === state) : house;
  // After an election, once new terms have begun: did the holder return, and (Senate) who holds the seat now.
  // House districts can be redrawn between Congresses, so no House successor is named.
  const newTermsBegin = `${year + 1}-01-03`;
  // Only once the new terms are in the member data, so a day's delay in the source never reads as "did not return".
  const outcomeKnown = past && today >= newTermsBegin && (seats || []).some((t) => t.start_date >= newTermsBegin && t.start_date <= `${year + 1}-03-01`);
  const outcome = (x) => {
    if (!outcomeKnown) return null;
    const within = (t) => t.start_date >= x.end_date && t.start_date <= `${year + 1}-03-01`;
    if ((seats || []).some((t) => t.bioguide_id === x.bioguide_id && t.chamber === x.chamber && within(t))) return { returned: true };
    const next = x.chamber === "senate" && (seats || []).find((t) => t.chamber === "senate" && t.state === x.state && t.senate_class === x.senate_class && t.bioguide_id !== x.bioguide_id && within(t));
    return { returned: false, next: next || null };
  };
  const yours = [...senate, ...house].filter((x) => mine.has(x.bioguide_id));
  const supervisors = (local?.supervisors ?? []).filter((s) => localOnBallot(s.term_end, year));
  const councils = (local?.cities ?? []).map((c) => ({ ...c, up: (c.members ?? []).filter((m) => yearOfLabel(m.term_end_label) === year) })).filter((c) => c.up.length);

  const Outcome = ({ x }) => {
    const o = outcome(x);
    if (!o) return null;
    if (o.returned) return <span className="face-outcome">{tr("Re-elected", "Reelegido(a)")}</span>;
    if (o.next) {
      const n = (seats || []).find((t) => t.bioguide_id === o.next.bioguide_id);
      return <span className="face-outcome">{tr("Seat now held by ", "Escaño ocupado ahora por ")}<Link to={`/member/${o.next.bioguide_id}`}>{n?.name ?? o.next.bioguide_id}</Link> <PartyName party={o.next.party} /></span>;
    }
    return <span className="face-outcome">{tr("Did not return", "No regresó")}</span>;
  };

  // The holder's share in this year's general election, if they were a candidate in the results file.
  const Share = ({ x, className }) => {
    if (!results || !fecIds) return null;
    const sh = shareOn(fecIds.get(x.bioguide_id), results, generalElectionDate(year), x.chamber === "senate" ? "S" : "H");
    if (!sh) return null;
    const special = sh.special ? tr(" (special election)", " (elección especial)") : "";
    const text = sh.pct == null
      ? tr(`Unopposed in ${year}, no vote count`, `Sin oposición en ${year}, sin recuento de votos`)
      : tr(`${pctText(sh.pct)} in ${year}`, `${pctText(sh.pct)} en ${year}`);
    return <span className={className}>{text}{special}</span>;
  };

  const Holder = ({ x }) => (
    <>{x.name ? <Link to={`/member/${x.bioguide_id}`}>{x.name}</Link> : x.bioguide_id} <PartyName party={x.party} />
      {x.how === "appointment" && <span className="fine"> · {tr("appointed", "designado(a)")}</span>}</>
  );

  return (
    <main className="page wide">
      <h1>{tr(`On the ballot in ${year}`, `En la boleta en ${year}`)}<Ref id="src" text={<>{tr("Worked out from each official's term end date: Congress from the official member list (unitedstates/congress-legislators), Orange County from the Clerk of the Board and city websites. California's election cycles are set by the state constitution.", "Calculado a partir de la fecha de fin del período de cada funcionario: el Congreso según la lista oficial de miembros (unitedstates/congress-legislators) y el Condado de Orange según la Secretaría de la Junta y los sitios de las ciudades. Los ciclos electorales de California los fija la constitución del estado.")}</>} /></h1>
      <p className="lede">
        {past && outcomeKnown
          ? tr(`The general election was held on ${date(generalElectionDate(year))}. These seats were on the ballot. Each shows whether the person who held it returned when the new terms began on ${date(newTermsBegin)}, and for the Senate, who holds it now.`, `La elección general se celebró el ${date(generalElectionDate(year))}. Estos escaños estuvieron en la boleta. Cada uno indica si quien lo ocupaba regresó cuando comenzaron los nuevos períodos el ${date(newTermsBegin)} y, en el Senado, quién lo ocupa ahora.`)
          : past
          ? tr(`The general election was held on ${date(generalElectionDate(year))}. These seats were on the ballot; the people listed hold them until the new terms begin on ${date(newTermsBegin)}. Who won each seat is shown here from that day, from the official member list. Until then, each state's election office publishes the results.`, `La elección general se celebró el ${date(generalElectionDate(year))}. Estos escaños estuvieron en la boleta; las personas indicadas los ocupan hasta que comiencen los nuevos períodos el ${date(newTermsBegin)}. Quién ganó cada escaño se mostrará aquí desde ese día, según la lista oficial de miembros. Hasta entonces, la oficina electoral de cada estado publica los resultados.`)
          : tr(`General election: ${date(generalElectionDate(year))}. These seats are on the ballot, listed with who holds them now. A seat on the ballot doesn't mean its holder is running.`, `Elección general: ${date(generalElectionDate(year))}. Estos escaños están en la boleta, con quién los ocupa ahora. Que un escaño esté en la boleta no significa que su titular se presente.`)}
      </p>
      {past && results && (
        <p className="fine">
          {tr(`Percentages are each holder's share of all votes in the ${year} general election for the seat, when they were a candidate, from `, `Los porcentajes son la proporción de todos los votos que obtuvo cada titular en la elección general de ${year} para el escaño, si fue candidato(a), según `)}
          <a href={results.source.url}>{results.source.title}</a> ({results.source.publisher}).{" "}
          {results.percent === "calculated" && tr("That source prints votes only; the percent is calculated from them.", "Esa fuente solo da votos; el porcentaje se calcula a partir de ellos.")}{" "}
          <Link to="/methods#election-results">{tr("How", "Cómo")}</Link>
        </p>
      )}
      {seats && <SeatChart years={years} year={year} counts={years.map((y) => [y, held(senateIn(y))])} onPick={(y) => set({ year: y, state: "" })} />}
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
              <>
                <ul className="face-grid">{senate.map((x) => (
                  <li key={x.bioguide_id}>
                    <Link to={`/member/${x.bioguide_id}`}>
                      <Portrait size="tile" party={x.party} src={`https://unitedstates.github.io/images/congress/225x275/${x.bioguide_id}.jpg`} width="112" height="137" loading="lazy" />
                      <span className="face-name">{x.name ?? x.bioguide_id}</span>
                    </Link>
                    <span className="face-meta">{stateName(x.state)}</span>
                    <Share x={x} className="face-meta" />
                    <Outcome x={x} />
                    {x.how === "appointment" && <span className="face-meta">{x.end_date < `${year}-01-01` ? tr(`Appointed until a special election; term ends ${date(x.end_date)}`, `Designado(a) hasta una elección especial; el período termina el ${date(x.end_date)}`) : tr("Appointed", "Designado(a)")}</span>}
                  </li>
                ))}</ul>
              </>
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
                <ul className="plain">{houseShown.map((x) => <li key={x.bioguide_id}>{seatLabel(x)}: <Holder x={x} />{results && fecIds && shareOn(fecIds.get(x.bioguide_id), results, generalElectionDate(year), "H") && <> · <Share x={x} /></>}{outcomeKnown && <> · <Outcome x={x} /></>}</li>)}</ul>
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
            {measures && <CaMeasures groups={byElection(measures).filter((e) => e.date.startsWith(`${year}-`))} />}
            {caResults && caResults.election.startsWith(`${year}-`) && <CaResultsBlock data={caResults} />}
          </section>

          {local && (supervisors.length > 0 || councils.length > 0) && (
            <section className="section">
              <h2>{tr("Orange County", "Condado de Orange")}</h2>
              {supervisors.length > 0 && (
                <>
                  <h3>{tr("Board of Supervisors", "Junta de Supervisores")}</h3>
                  <ul className="plain">{supervisors.map((s) => <li key={s.district}>{tr(`District ${s.district}`, `Distrito ${s.district}`)}: {s.name} · {tr("term ends", "fin del período")} {date(s.term_end)}</li>)}</ul>
                  <p className="fine">{tr(`Supervisor seats are nonpartisan. A candidate who wins a majority in the June ${year} primary is elected then; only seats where no one did go on to the November ballot. The Registrar's results show which.`, `Los cargos de supervisor son no partidistas. Quien obtiene la mayoría en la primaria de junio de ${year} queda elegido; solo los cargos donde nadie la obtuvo pasan a la boleta de noviembre. Los resultados del Registro de Votantes muestran cuáles.`)}</p>
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

// Statewide measures on this year's California ballots so far, by election, each linked to its entry
// on the Measures page. Titles as the official lists print them.
function CaMeasures({ groups }) {
  if (!groups.length) return null;
  return (
    <div id="ca-measures">
      <h3>{tr("Statewide ballot measures so far", "Medidas estatales en la boleta hasta ahora")}</h3>
      {groups.map((e) => (
        <div key={e.date}>
          <p><strong>{tr(e.name, electionNameEs(e, date))}</strong></p>
          <ul className="plain">
            {e.measures.map((m) => (
              <li key={m.id}><Link to={`/measures#${m.id}`}>{m.label}</Link>: <span lang="en">{m.title}</span>
                {m.status === "eligible" && <span className="fine"> · {tr("eligible, not yet certified", "elegible, aún no certificada")}</span>}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// California's results from the Secretary of State: statewide offices, Board of Equalization, measures,
// and the U.S. House districts (folded, since member pages show each member's own race).
function CaResultsBlock({ data }) {
  return (
    <div className="ca-results" id="ca-results">
      <h3>{tr("Results from the Secretary of State", "Resultados de la Secretaría de Estado")}</h3>
      <ResultsStatus data={data} />
      <PartyKey />
      <h3>{tr("Statewide offices", "Cargos estatales")}</h3>
      <div className="results-grid">
        {data.statewide.map((r) => <RaceResult key={r.office} race={r} title={tr(...(OFFICE_TITLES[r.office] ?? [r.race_title, r.race_title]))} />)}
      </div>
      <h3>{tr("Board of Equalization", "Junta de Igualación")}</h3>
      <div className="results-grid">
        {data.boe.map((r) => <RaceResult key={r.district} race={r} title={tr(`District ${r.district}`, `Distrito ${r.district}`)} />)}
      </div>
      <h3>{tr("Statewide ballot measures", "Medidas estatales en la boleta")}</h3>
      <div className="results-grid">
        {data.measures.map((m) => <MeasureResult key={m.number} m={m} />)}
      </div>
      <details>
        <summary>{tr(`U.S. House: California's ${data.house.length} districts (new maps in 2026)`, `Cámara de EE. UU.: los ${data.house.length} distritos de California (mapas nuevos en 2026)`)}</summary>
        <div className="results-grid">
          {data.house.map((r) => <RaceResult key={r.district} race={r} title={tr(`District ${r.district}`, `Distrito ${r.district}`)} />)}
        </div>
      </details>
      <p className="fine">{tr("No U.S. Senate seat from California was on the 2026 ballot. Civic Atlas shows the counts as published and doesn't call races.", "Ningún escaño de California en el Senado de EE. UU. estuvo en la boleta de 2026. Civic Atlas muestra los conteos tal como se publican y no declara ganadores.")}</p>
    </div>
  );
}

const partyLetter = (party) => (party === "Democrat" ? "D" : party === "Republican" ? "R" : partyName(party).slice(0, 1));
const PARTY_ORDER = ["Democrat", "Republican"];

// Senate seats on each year's ballot, by the party of the senator who holds each seat now: one cluster
// of bars per year, a bar per party, the count on each bar. Tapping a year shows that year's seats.
function SeatChart({ years, year, counts, onPick }) {
  const shown = counts.filter(([, c]) => c.length);
  if (!shown.length) return null;
  const parties = [...new Set(shown.flatMap(([, c]) => c.map(([p]) => p)))]
    .sort((a, z) => (PARTY_ORDER.indexOf(a) + 1 || 9) - (PARTY_ORDER.indexOf(z) + 1 || 9));
  const max = Math.max(...shown.flatMap(([, c]) => c.map(([, n]) => n)));
  const missing = years.filter((y) => !shown.some(([sy]) => sy === y));
  return (
    <figure className="seat-chart">
      <figcaption>
        <strong>{tr("Senate seats on the ballot, by party of the senator who holds each seat now", "Escaños del Senado en la boleta, según el partido de quien ocupa cada escaño ahora")}</strong>
        <span className="seat-legend">{parties.map((p) => <span key={p}><span className={partyClass(p)}>{partyLetter(p)}</span> {partyName(p)}</span>)}</span>
      </figcaption>
      {/* A group of buttons, one per election year (an image role here would hide the buttons from
          screen readers). Each count carries its party name, hidden, so a button reads
          "22 Republican, 13 Democrat, 2028": the visible numbers and year, in order. */}
      <div className="seat-bars" role="group" aria-label={tr("Choose an election year", "Elija un año de elección")}>
        {shown.map(([y, c]) => (
          <button key={y} type="button" className={`seat-cluster${y === year ? " on" : ""}`} onClick={() => onPick(y)} aria-pressed={y === year}>
            <span className="seat-cluster-bars">
              {parties.map((p) => {
                const n = c.find(([q]) => q === p)?.[1] ?? 0;
                return (
                  <span key={p} className="seat-bar-wrap" title={`${y}: ${n} ${partyName(p)}`}>
                    <span className="seat-count">{n}<span className="visually-hidden"> {partyName(p)},</span></span>
                    <span className={`seat-bar ${partyClass(p).split(" ")[1]}`} style={{ height: `${(n / max) * 100}%` }} />
                  </span>
                );
              })}
            </span>
            <span className="seat-year">{y}</span>
          </button>
        ))}
      </div>
      {missing.length > 0 && <p className="fine">{tr(`${missing.join(", ")}: shown once the senators elected before then take office.`, `${missing.join(", ")}: se muestra cuando asuman los senadores elegidos antes.`)}</p>}
    </figure>
  );
}
