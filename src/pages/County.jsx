import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { loadLocal } from "../lib/local.js";
import { CouncilCard, OfficerCard, SupervisorCard } from "../components/LocalOfficials.jsx";
import LocalMeetings from "../components/LocalMeetings.jsx";

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
  return (
    <main className="page wide">
      <p className="fine"><Link to="/">{tr("Home", "Inicio")}</Link> / California</p>
      <h1>{data.county}</h1>
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
      <p className="notice">{tr("Votes and campaign money for county and city officials aren't on Civic Atlas yet.", "Los votos y los fondos de campaña de los funcionarios del condado y de la ciudad aún no están en Civic Atlas.")}</p>
      <p className="fine">
        {tr(`Sources (checked ${date(data.checked)}): `, `Fuentes (verificadas el ${date(data.checked)}): `)}
        {data.sources.map((s, i) => <span key={s.url}>{i ? "; " : ""}<a href={s.url} rel="noopener">{s.label}</a></span>)}.
      </p>
    </main>
  );
}
