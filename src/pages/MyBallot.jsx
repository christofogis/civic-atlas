import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Portrait from "../components/Portrait.jsx";
import Seat from "../components/Seat.jsx";
import { PartyName } from "../components/PartyTag.jsx";
import { StatePartyTag } from "../components/StateOfficialCard.jsx";
import { NotesList, Ref } from "../components/Notes.jsx";
import { date, stateName } from "../lib/format.js";
import { tr, getLang } from "../lib/lang.js";
import { stateOfficeParts } from "../lib/stateOffices.js";
import { savedDistricts } from "../lib/savedDistricts.js";
import { assembleBallot } from "../../lib/myBallot.js";
import { electionNameEs } from "../../lib/measures.js";
import { TERM_CALENDARS } from "../../lib/stateleg.js";
import { VOTE_GOV } from "../../lib/firstVoter.js";

// "Your 2028 ballot": every contest and statewide measure on the visitor's 2028 ballots, by election,
// from the districts of their last lookup on this device (never an address, and nothing in the URL).
// Each contest shows who holds the seat now and never a candidate list: candidates are known only once
// filing closes. Dates come only from the Secretary of State and the county Registrar; until they
// publish them, the page says so. Same layout for every visitor; outside California, only federal
// contests, with the same cards.
const todayLA = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const YEAR = 2028;
const getJson = (path) => fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(path))));
const CA_COUNTY_OFFICES = "https://www.sos.ca.gov/elections/voting-resources/county-elections-offices";
const AMENDMENT_20 = "https://constitution.congress.gov/constitution/amendment-20/";

export default function MyBallot() {
  const saved = savedDistricts();
  const params = useMemo(() => new URLSearchParams(saved ?? ""), [saved]);
  const st = params.get("st");
  const [result, setResult] = useState(null);
  const [extra, setExtra] = useState(null);

  useEffect(() => {
    if (!saved) return;
    fetch(`/api/officials?${saved}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setResult).catch(() => setResult(false));
    const opt = (p) => getJson(p).catch(() => null);
    Promise.all([
      opt("/data/measures/ca-2028.json"),
      params.get("co") === "ca-orange" ? opt("/data/local/ca-orange.json") : null,
      opt("/maps/meta.json"),
      opt("/data/us-control.json"),
      st === "CA" ? opt("/data/ballot/ca-2028.json") : null,
    ]).then(([measures, local, meta, control, official]) => setExtra({ measures, local, changed120: meta?.changed120 ?? [], presidents: control?.presidents ?? [], presidentSource: control?.sources?.president, official }));
  }, [saved, params, st]);

  if (!saved) {
    return (
      <main className="page my-ballot">
        <h1>{tr(`Your ${YEAR} ballot`, `Su boleta de ${YEAR}`)}</h1>
        <p className="lede">{tr(`Look up your address once, and this page lists every contest and statewide measure you'll vote on in ${YEAR}, with who holds each seat now and the official deadlines.`,
          `Busque su dirección una vez y esta página mostrará cada contienda y medida estatal en la que votará en ${YEAR}, con quién ocupa cada escaño ahora y las fechas límite oficiales.`)}</p>
        <p><Link className="button-primary" to="/">{tr("Look up your address", "Buscar su dirección")}</Link></p>
        <p className="fine">{tr("Only your district numbers are kept, on this device. Your address is never stored.", "Solo se guardan los números de sus distritos, en este dispositivo. Su dirección nunca se guarda.")}</p>
        <p className="fine"><Link to={`/on-the-ballot?year=${YEAR}`}>{tr(`Every seat on the ${YEAR} ballot nationwide`, `Todos los escaños en la boleta de ${YEAR} en el país`)}</Link></p>
      </main>
    );
  }

  const today = todayLA();
  const ready = result !== null && extra;
  const ballot = ready ? assembleBallot({ params, result: result || null, today, year: YEAR, ...extra }) : null;
  const where = [params.get("pl"), stateName(st)].filter(Boolean).join(", ");

  return (
    <main className="page my-ballot">
      <h1>{tr(`Your ${YEAR} ballot`, `Su boleta de ${YEAR}`)}</h1>
      <p className="lede">
        {tr(`Every contest and statewide measure on your ${YEAR} ballots${where ? ` for ${where}` : ""}, in ballot order, with who holds each seat now. A seat on the ballot doesn't mean its holder is running.`,
          `Cada contienda y medida estatal en sus boletas de ${YEAR}${where ? ` para ${where}` : ""}, en el orden de la boleta, con quién ocupa cada escaño ahora. Que un escaño esté en la boleta no significa que su titular se presente.`)}
      </p>
      <p className="fine no-print">
        {tr("From the districts of your last lookup on this device. Your address isn't stored. ", "Según los distritos de su última búsqueda en este dispositivo. Su dirección no se guarda. ")}
        <Link to="/">{tr("Look up a different address", "Buscar otra dirección")}</Link>
        {" · "}<button type="button" className="button-secondary small" onClick={() => window.print()}>{tr("Print", "Imprimir")}</button>
      </p>

      {result === false && <p className="notice">{tr("Your officials didn't load. Reload the page to try again.", "Sus funcionarios no se cargaron. Vuelva a cargar la página.")}</p>}
      {!ready ? <p>{tr("Loading…", "Cargando…")}</p> : (
        <>
          <Deadlines ballot={ballot} official={extra.official} county={params.get("co")} />
          {ballot.elections.map((e) => (
            <section className="section ballot-election" key={e.date} id={`election-${e.date}`}>
              <h2>{e.name ? tr(e.name, electionNameEs(e, date)) : tr(`General election: ${date(e.date)}`, `Elección general: ${date(e.date)}`)}
                {e.name && <Ref id="ca-elections" text={<>{tr("Election dates as the Secretary of State lists them: ", "Fechas de las elecciones según la Secretaría de Estado: ")}<a href={extra.official?.elections_source ?? extra.measures?.sources?.qualified}>{tr("Qualified statewide ballot measures", "Medidas estatales calificadas")}</a>.</>} />}
              </h2>
              {!ballot.california && <p className="fine">{tr(`Primary dates differ by state and aren't on Civic Atlas. `, `Las fechas de las primarias varían por estado y no están en Civic Atlas. `)}<a href={getLang() === "es" ? VOTE_GOV.es : VOTE_GOV.en}>{tr(`${stateName(st)}'s election dates: vote.gov`, `Fechas electorales de ${stateName(st)}: vote.gov`)}</a></p>}
              <ul className="cards ballot-contests">
                {e.contests.map((c) => <Contest key={c.key} c={c} election={e} state={st} official={extra.official} presidentSource={extra.presidentSource} />)}
              </ul>
              {e.measures.length > 0 && (
                <>
                  <h3>{tr("Statewide ballot measures", "Medidas estatales en la boleta")}<Ref id="ca-measures" text={<>{tr("Measures and their status from the Secretary of State's ", "Medidas y su estado según las listas de la Secretaría de Estado: ")}<a href={extra.measures.sources.qualified}>{tr("qualified", "calificadas")}</a>{tr(" and ", " y ")}<a href={extra.measures.sources.eligible}>{tr("eligible", "elegibles")}</a>{tr(" lists.", ".")}</>} /></h3>
                  <ul className="plain ballot-measures">
                    {e.measures.map((m) => (
                      <li key={m.id}><Link to={`/measures#${m.id}`}>{m.label}</Link>: <span lang="en">{m.title}</span>
                        {m.status === "eligible" && <span className="fine"> · {tr("eligible, not yet certified for the ballot", "elegible, aún no certificada para la boleta")}</span>}</li>
                    ))}
                  </ul>
                  <p className="fine">{tr("Each measure's page has the official text, the Legislative Analyst's analysis, each side's official arguments and who is funding each side, as they are published.", "La página de cada medida tiene el texto oficial, el análisis del Analista Legislativo, los argumentos oficiales de cada lado y quién financia a cada lado, según se publican.")}</p>
                </>
              )}
            </section>
          ))}
          {ballot.notes.length > 0 && (
            <section className="section">
              <h2>{tr("Also for your address", "También para su dirección")}</h2>
              <ul className="plain">{ballot.notes.map((n, i) => <li key={i}><Note n={n} /></li>)}</ul>
            </section>
          )}
        </>
      )}
      <p className="fine no-print"><Link to="/first-time-voter">{tr("First time voting? How to register", "¿Va a votar por primera vez? Cómo inscribirse")}</Link>{" · "}<Link to="/methods#my-ballot">{tr("How this page is put together", "Cómo se arma esta página")}</Link></p>
      <NotesList />
    </main>
  );
}

// The deadlines box: dates only as the Secretary of State and the Registrar publish them, and the rules
// they state. Outside California, vote.gov.
function Deadlines({ ballot, official, county }) {
  if (!ballot.california || !official) {
    return (
      <section className="ballot-deadlines">
        <h2>{tr("Deadlines", "Fechas límite")}</h2>
        <p>{tr(`Registration deadlines, voting by mail and early voting are set by each state. vote.gov links to ${stateName(ballot.state)}'s official election office.`, `Las fechas de inscripción, el voto por correo y la votación anticipada los fija cada estado. vote.gov enlaza a la oficina electoral oficial de ${stateName(ballot.state)}.`)}</p>
        <p><a className="button-primary" href={getLang() === "es" ? VOTE_GOV.es : VOTE_GOV.en}>{tr("Register or check your state's rules at vote.gov", "Inscríbase o consulte las reglas de su estado en vote.gov")}</a></p>
      </section>
    );
  }
  const mine = (x) => !x.county || x.county === county;
  const ROWS = [["registration_deadline", "Registration deadline", "Fecha límite de inscripción"], ["vote_by_mail_mailing", "Vote-by-mail ballots mailed", "Envío de boletas de voto por correo"], ["early_voting", "Early voting", "Votación anticipada"]];
  const dateText = (v) => (v ? <>{v.until ? `${date(v.date)}–${date(v.until)}` : date(v.date)} (<a href={v.source}>{tr("source", "fuente")}</a>)</> : <span className="ballot-unpublished">{tr("not published yet", "aún no publicada")}</span>);
  return (
    <section className="ballot-deadlines" aria-labelledby="deadlines-head">
      <h2 id="deadlines-head">{tr("Deadlines and how to vote", "Fechas límite y cómo votar")}</h2>
      {ballot.elections.every((e) => ROWS.every(([k]) => !official.dates?.[e.date]?.[k])) ? (
        <p>{tr(`Registration deadline, when vote-by-mail ballots are mailed, and early voting dates, for ${ballot.elections.map((e) => date(e.date)).join(tr(" and ", " y "))}: `, `Fecha límite de inscripción, envío de las boletas de voto por correo y fechas de votación anticipada, para el ${ballot.elections.map((e) => date(e.date)).join(" y el ")}: `)}<span className="ballot-unpublished">{tr("not published yet", "aún no publicadas")}</span>.</p>
      ) : (
      <table className="ballot-dates">
        <thead><tr><th scope="col"><span className="visually-hidden">{tr("Date", "Fecha")}</span></th>{ballot.elections.map((e) => <th key={e.date} scope="col">{date(e.date)}</th>)}</tr></thead>
        <tbody>
          {ROWS.map(([k, en, es]) => (
            <tr key={k}><th scope="row">{tr(en, es)}</th>{ballot.elections.map((e) => <td key={e.date}>{dateText(official.dates?.[e.date]?.[k])}</td>)}</tr>
          ))}
        </tbody>
      </table>
      )}
      <p className="fine">{tr(`As of ${date(official.checked)}, the Secretary of State and the county Registrar haven't published 2028 dates. They're added here when they do: `, `Al ${date(official.checked)}, la Secretaría de Estado y el Registro de Votantes del condado no han publicado las fechas de 2028. Se agregarán aquí cuando lo hagan: `)}
        {official.dates_where.filter(mine).map((w, i) => <span key={w.url}>{i ? " · " : ""}<a href={w.url}>{tr(w.en, w.es)}</a></span>)}</p>
      <h3>{tr("The rules, as the election offices state them", "Las reglas, según las oficinas electorales")}</h3>
      <ul className="plain ballot-rules">
        {official.rules.filter(mine).map((r) => <li key={r.id}>{tr(r.en, r.es)} <a href={r.source} className="fine">({tr(r.source_title, r.source_title_es)})</a></li>)}
      </ul>
      <p className="ballot-links">{official.links.filter(mine).map((l, i) => <span key={l.id}>{i ? " · " : ""}<a href={(getLang() === "es" && l.url_es) || l.url}>{tr(l.en, l.es)}</a></span>)}</p>
    </section>
  );
}

const OFFICE = {
  president: () => [tr("President and Vice President", "Presidente y Vicepresidente"), tr("United States", "Estados Unidos")],
  "us-senate": (c, st) => [tr("U.S. Senate", "Senado de EE. UU."), stateName(st)],
  "us-house": (c, st) => [tr("U.S. House", "Cámara de EE. UU."), c.district != null ? (c.district === 0 ? tr(`${stateName(st)}, at large`, `${stateName(st)}, en general`) : tr(`${stateName(st)}, District ${c.district}`, `${stateName(st)}, Distrito ${c.district}`)) : stateName(st)],
  "state-senate": (c, st) => stateOfficeParts({ type: "upper", district: c.district }, st),
  assembly: (c, st) => stateOfficeParts({ type: "lower", district: c.district }, st),
  supervisor: (c) => [tr("Orange County Board of Supervisors", "Junta de Supervisores del Condado de Orange"), tr(`District ${c.district}`, `Distrito ${c.district}`)],
  council: (c) => [tr(`${c.city} City Council`, `Concejo Municipal de ${c.city}`), c.district ? tr(`District ${c.district}`, `Distrito ${c.district}`) : tr(`${c.seats} at-large seat${c.seats === 1 ? "" : "s"}`, `${c.seats} escaño${c.seats === 1 ? "" : "s"} en general`)],
};

function Holder({ h, presidentSource }) {
  const name = h.href ? (h.external ? <a href={h.href} rel="noopener">{h.name}</a> : <Link to={h.href}>{h.name}</Link>) : h.name;
  return (
    <div className="ballot-holder">
      {(h.level === "federal" || h.level === "state") && (
        <Portrait className="member-photo small" size="small" party={h.party} src={h.photo} alt="" width="60" height="73" loading="lazy" referrerPolicy="no-referrer" />
      )}
      <p className="meta">{tr("Holds the seat now", "Ocupa el escaño ahora")}{h.level === "president" && presidentSource && <Ref id="president" text={<>{tr("Who holds the presidency: ", "Quién ocupa la presidencia: ")}<a href={presidentSource}>{tr("The White House, Presidents", "La Casa Blanca, Presidentes")}</a>.</>} />}</p>
      <h3>{name}</h3>
      <p className="meta">
        {h.level === "state" ? (h.party && <><StatePartyTag party={h.party} /> {h.party}</>) : h.party ? <PartyName party={h.party} /> : tr("Nonpartisan office", "Cargo no partidista")}
      </p>
    </div>
  );
}

function Contest({ c, election, state, official, presidentSource }) {
  const filing = official?.dates?.[election.date]?.candidate_filing;
  const ca = state === "CA";
  const termRule = TERM_CALENDARS.CA.source;
  return (
    <li className={`card ballot-contest${c.status === "held" ? "" : " pending"}`}>
      <Seat parts={OFFICE[c.office](c, state)} />
      {c.status === "held" && c.holders.map((h) => <Holder key={h.id ?? h.name} h={h} presidentSource={presidentSource} />)}
      {c.status === "updating" && <p>{c.termBegan
        ? tr(`New term began ${date(c.termBegan)}; data updating.`, `Comenzó un nuevo período el ${date(c.termBegan)}; datos en actualización.`)
        : tr("New term began; data updating.", "Comenzó un nuevo período; datos en actualización.")}</p>}
      {c.status === "not-seated" && (c.office === "us-house"
        ? <p>{tr(`Who holds this seat is shown from ${date(c.takesOffice)}, when the members elected in November 2026 take office `, `Quién ocupa este escaño se mostrará desde el ${date(c.takesOffice)}, cuando asuman los miembros elegidos en noviembre de 2026 `)}(<a href={AMENDMENT_20}>{tr("20th Amendment", "Enmienda 20")}</a>).</p>
        : <p>{tr(`Who holds this seat is shown from ${date(c.takesOffice)}, when the members elected in November 2026 take office `, `Quién ocupa este escaño se mostrará desde el ${date(c.takesOffice)}, cuando asuman los miembros elegidos en noviembre de 2026 `)}(<a href={termRule}>{tr("California Constitution, Art. IV, sec. 2", "Constitución de California, art. IV, sec. 2")}</a>).</p>)}
      {c.status === "district-unknown" && <p>{c.reason === "new-lines"
        ? tr(`${stateName(state)}'s congressional districts change on ${date(c.linesFrom)}, and your last lookup used the current lines. Look up your address again on or after ${date(c.linesFrom)} to see your district for ${YEAR}.`, `Los distritos del Congreso de ${stateName(state)} cambian el ${date(c.linesFrom)}, y su última búsqueda usó los límites actuales. Vuelva a buscar su dirección a partir del ${date(c.linesFrom)} para ver su distrito de ${YEAR}.`)
        : tr("Look up your address again to see your district for this election.", "Vuelva a buscar su dirección para ver su distrito en esta elección.")}{" "}<Link to="/" className="no-print">{tr("Look up", "Buscar")}</Link></p>}
      {c.status === "unknown" && <p>{tr("Not on record.", "No registrado.")}</p>}

      {c.primary === "top-two" && <p className="fine">{tr("Top-two primary: candidates of every party are on one ballot, and the two with the most votes go on to November.", "Primaria de los dos más votados: los candidatos de todos los partidos van en una sola boleta, y los dos con más votos pasan a noviembre.")}</p>}
      {c.primary === "presidential" && <p className="fine">{tr("Presidential primary: candidates run for their party's nomination.", "Primaria presidencial: los candidatos compiten por la nominación de su partido.")}</p>}
      {c.primary === "majority" && <p className="fine">{tr("Nonpartisan. A candidate who wins a majority on March 7 is elected; otherwise the top two go on to November.", "No partidista. Quien obtiene la mayoría el 7 de marzo queda elegido; si nadie la obtiene, los dos más votados pasan a noviembre.")}</p>}
      {c.general === "if-no-majority" && <p className="fine">{tr("On this ballot only if no candidate won a majority on March 7.", "En esta boleta solo si ningún candidato obtuvo la mayoría el 7 de marzo.")}</p>}

      <p className="fine ballot-candidates">
        <strong>{tr("Candidates:", "Candidatos:")}</strong>{" "}
        {filing
          ? tr(`not filed for the ballot yet. Filing opens ${date(filing.opens)}`, `aún no inscritos en la boleta. La inscripción abre el ${date(filing.opens)}`)
          : ca ? tr("not filed for the ballot yet. Filing dates not published yet.", "aún no inscritos en la boleta. Las fechas de inscripción aún no se publican.")
            : tr(`not filed for the ballot yet. ${stateName(state)} sets its own filing dates.`, `aún no inscritos en la boleta. ${stateName(state)} fija sus propias fechas de inscripción.`)}
        {filing && <> (<a href={filing.source}>{tr("source", "fuente")}</a>).</>}
        {["president", "us-senate", "us-house"].includes(c.office) && <> <Link to="/elections" className="no-print">{tr("Who has registered a campaign with the FEC", "Quién ha registrado una campaña ante la FEC")}</Link></>}
      </p>
    </li>
  );
}

function Note({ n }) {
  switch (n.key) {
    case "state-senate-not-up":
      return tr(`Your California State Senate district (${n.district}) isn't on the ${YEAR} ballot; it's next elected in ${n.next}.`, `Su distrito del Senado de California (${n.district}) no está en la boleta de ${YEAR}; se elige de nuevo en ${n.next}.`);
    case "supervisor-not-up":
      return tr(`Your Board of Supervisors district (${n.district}) isn't on the ${YEAR} ballot.`, `Su distrito de la Junta de Supervisores (${n.district}) no está en la boleta de ${YEAR}.`);
    case "supervisor-district-unknown":
      return tr("Your Board of Supervisors district wasn't found in your last lookup.", "Su distrito de la Junta de Supervisores no se encontró en su última búsqueda.");
    case "county-officers-unknown":
      return <>{tr("Countywide offices (such as Sheriff, District Attorney and Assessor) aren't listed here: their term dates aren't recorded on Civic Atlas yet. The Registrar lists every contest once the ballot is set: ", "Los cargos de todo el condado (como Alguacil, Fiscal de Distrito y Tasador) no aparecen aquí: las fechas de sus períodos aún no están registradas en Civic Atlas. El Registro de Votantes publica cada contienda cuando la boleta está lista: ")}<a href={n.url}>{tr("Orange County Registrar of Voters", "Registro de Votantes del Condado de Orange")}</a>.</>;
    case "city-not-loaded":
      return <>{tr(`${n.city}'s city election information isn't loaded on Civic Atlas yet. `, `La información electoral de la ciudad de ${n.city} aún no está en Civic Atlas. `)}
        {n.url && <><a href={n.url} rel="noopener">{tr(`City of ${n.city}`, `Ciudad de ${n.city}`)}</a>{" · "}</>}<a href={n.registrar}>{tr("Orange County Registrar of Voters", "Registro de Votantes del Condado de Orange")}</a></>;
    case "council-not-up":
      return n.district
        ? tr(`Your ${n.city} City Council district (${n.district}) isn't on the ${YEAR} ballot.`, `Su distrito del Concejo Municipal de ${n.city} (${n.district}) no está en la boleta de ${YEAR}.`)
        : tr(`No ${n.city} City Council seats are recorded as up in ${YEAR}.`, `No hay escaños del Concejo Municipal de ${n.city} registrados para ${YEAR}.`);
    case "unincorporated":
      return n.place
        ? tr(`No city council contest: ${n.place} is unincorporated, so the county Board of Supervisors makes local decisions there.`, `Sin contienda de concejo municipal: ${n.place} no está incorporada, así que la Junta de Supervisores del condado toma las decisiones locales.`)
        : tr("No city council contest: this address is in an unincorporated area.", "Sin contienda de concejo municipal: esta dirección está en una zona no incorporada.");
    case "local-not-covered":
      return <>{tr("County and city contests are on Civic Atlas for Orange County only, so far. Your county elections office lists them: ", "Por ahora, las contiendas de condado y ciudad están en Civic Atlas solo para el Condado de Orange. La oficina electoral de su condado las publica: ")}<a href={CA_COUNTY_OFFICES}>{tr("county elections offices (Secretary of State)", "oficinas electorales de los condados (Secretaría de Estado)")}</a>.</>;
    case "state-not-covered":
      return <>{tr(`State and local contests in ${stateName(n.state)} aren't covered on Civic Atlas yet. `, `Las contiendas estatales y locales de ${stateName(n.state)} aún no están en Civic Atlas. `)}<a href={getLang() === "es" ? VOTE_GOV.es : VOTE_GOV.en}>{tr("vote.gov links to your state's election office", "vote.gov enlaza a la oficina electoral de su estado")}</a>.</>;
    default:
      return null;
  }
}
