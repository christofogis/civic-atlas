import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { loadLocal } from "../lib/local.js";
import { CouncilCard, OfficerCard, SupervisorCard } from "../components/LocalOfficials.jsx";
import LocalMeetings from "../components/LocalMeetings.jsx";
import CountyAgenda from "../components/CountyAgenda.jsx";
import CityAgendas from "../components/CityAgendas.jsx";
import { savedDistricts } from "../lib/savedDistricts.js";
import { NotesList, NotesProvider, Ref } from "../components/Notes.jsx";

// A county's elected officials (pilot: Orange County, CA). Data: a small file kept from the
// county's own pages, checked weekly against them; districts from the county's GIS layer.
export default function County() {
  const { id } = useParams();
  const [data, setData] = useState(undefined);
  useEffect(() => {
    if (!/^[a-z-]+$/.test(id)) { setData(null); return; }
    loadLocal(id).then((d) => { setData(d); document.title = `${d.county} · Civic Atlas`; }).catch(() => setData(null));
  }, [id]);
  if (data === undefined) return <main className="page"><p className="fine">{tr("Loading…", "Cargando…")}</p></main>;
  if (data === null) return <main className="page"><h1>{tr("Not found", "No encontrado")}</h1><p><Link to="/">{tr("Look up your address", "Busque su dirección")}</Link></p></main>;
  const notes = [
    { id: "sources", text: <>{tr(`Officials and terms are kept by hand from the county's own pages and checked against them weekly; last checked ${date(data.checked)}. Sources: `, `Los funcionarios y sus períodos se toman a mano de las páginas del condado y se comparan con ellas cada semana; última verificación: ${date(data.checked)}. Fuentes: `)}
      {data.sources.map((s, i) => <span key={s.url}>{i ? "; " : ""}<a href={s.url} rel="noopener">{s.label}</a></span>)}.</> },
    data.board_meetings && { id: "schedule", text: <>{tr("Board meeting dates come from the county's approved yearly schedules: ", "Las fechas de reunión de la Junta vienen de los calendarios anuales aprobados por el condado: ")}
      {data.board_meetings.sources.map((s, i) => <span key={s.url}>{i ? "; " : ""}<a href={s.url} rel="noopener">{s.label}</a></span>)}.</> },
    ...(data.cities ?? []).filter((c) => c.meeting_rule).map((c) => ({ id: `rule-${c.id}`, text: <>{tr(`${c.name} City Council meeting dates follow its regular-meeting rule (third Monday; on a holiday, the next business day): `, `Las fechas de reunión del Concejo Municipal de ${c.name} siguen su regla de reuniones ordinarias (tercer lunes; si es feriado, el siguiente día hábil): `)}<a href={c.meeting_rule.rule_source.url} rel="noopener">{c.meeting_rule.rule_source.label}</a>.</> })),
    data.city_websites && { id: "cities", text: <>{tr("City list and websites: ", "Lista de ciudades y sitios web: ")}<a href={data.city_websites.source.url} rel="noopener">{data.city_websites.source.label}</a>{tr(". Cities marked citywide have no council districts in the Registrar of Voters' city district file.", ". Las ciudades marcadas como en toda la ciudad no tienen distritos de concejo en el archivo de distritos municipales del Registro de Votantes.")}</> },
  ];
  return (
    <NotesProvider notes={notes}>
    <main className="page wide">
      <p className="fine"><Link to="/">{tr("Home", "Inicio")}</Link> / California</p>
      <h1>{data.county}<Ref id="sources" /></h1>
      <p className="lede">
        {tr("A five-member Board of Supervisors, each elected by one district, sets the county budget and policy and runs county services, including in unincorporated areas. Six more officials are elected countywide. All county offices in California are nonpartisan.",
          "Una Junta de Supervisores de cinco miembros, cada uno elegido por un distrito, aprueba el presupuesto y las políticas del condado y administra sus servicios, incluso en las zonas no incorporadas. Otros seis funcionarios se eligen en todo el condado. En California, todos los cargos de condado son no partidistas.")}
      </p>
      <h2>{tr("Board of Supervisors", "Junta de Supervisores")}</h2>
      <ul className="cards">{data.supervisors.map((s) => <SupervisorCard key={s.district} s={s} county={data.county} />)}</ul>
      <p className="branch-links">
        <a href={data.meetings_url} rel="noopener">{tr("Meetings and agendas", "Reuniones y agendas")}</a>
        <a href={data.results_url} rel="noopener">{tr("Election results (Registrar of Voters)", "Resultados electorales (Registro de Votantes)")}</a>
      </p>
      <LocalMeetings data={data} />
      {id === "ca-orange" && <CountyAgenda district={(() => { const p = new URLSearchParams(savedDistricts() ?? ""); return p.get("co") === id ? Number(p.get("sd")) || null : null; })()} />}
      <h2>{tr("Countywide elected officials", "Funcionarios elegidos en todo el condado")}</h2>
      <ul className="cards">{data.officers.map((o) => <OfficerCard key={o.office} o={o} county={data.county} />)}</ul>
      <h2>{tr("City councils", "Concejos municipales")}</h2>
      <p className="fine">{tr(`Orange County has 34 cities, each with its own council. So far: ${(data.cities ?? []).map((c) => c.name).join(", ")}. More are being added.`, `El Condado de Orange tiene 34 ciudades, cada una con su propio concejo. Hasta ahora: ${(data.cities ?? []).map((c) => c.name).join(", ")}. Se están agregando más.`)}</p>
      {(data.cities ?? []).map((c) => (
        <section key={c.id} id={c.id}>
          <h3>{tr(`${c.name} City Council`, `Concejo Municipal de ${c.name}`)}</h3>
          <p className="fine">{tr("Five members, each elected by one district for four years. Each December the council chooses one member as mayor.", "Cinco miembros, cada uno elegido por un distrito por cuatro años. Cada diciembre el concejo elige a uno de sus miembros como alcalde.")} {tr("Meets:", "Se reúne:")} {tr(c.meetings.en, c.meetings.es)}.</p>
          <ul className="cards">{c.members.map((m) => <CouncilCard key={m.district} m={m} city={c} />)}</ul>
          <LocalMeetings data={data} city={c} showBoard={false} heading={false} />
          <p className="branch-links">
            <a href={c.agendas_url} rel="noopener">{tr("Agendas and minutes", "Agendas y actas")}</a>
            <a href={c.website} rel="noopener">{tr("City Council page", "Página del Concejo Municipal")}</a>
            <a href={c.map_source.url} rel="noopener">{tr("Council district map", "Mapa de distritos del concejo")}</a>
          </p>
        </section>
      ))}
      {id === "ca-orange" && <CityAgendas />}
      {data.city_websites && (
        <section id="all-cities">
          <h3>{tr("All 34 cities", "Las 34 ciudades")}<Ref id="cities" /></h3>
          <p className="fine">{tr("Each city's own website lists its council members, agendas and meetings. Cities marked citywide elect their councils at large rather than by district.", "El sitio web de cada ciudad tiene los miembros de su concejo, agendas y reuniones. Las ciudades marcadas como en toda la ciudad eligen su concejo en general, no por distrito.")}</p>
          <ul className="city-list">
            {Object.entries(data.city_websites.cities).map(([name, url]) => (
              <li key={name}><a href={url} rel="noopener">{name}</a>{data.city_websites.at_large.includes(name) && <span className="fine"> · {tr("citywide", "en toda la ciudad")}</span>}</li>
            ))}
          </ul>
        </section>
      )}
      <p className="notice">{tr("Votes and campaign money for county and city officials aren't on Civic Atlas yet.", "Los votos y los fondos de campaña de los funcionarios del condado y de la ciudad aún no están en Civic Atlas.")}</p>
      <NotesList />
    </main>
    </NotesProvider>
  );
}
