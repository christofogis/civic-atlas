import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { loadLocal } from "../lib/local.js";
import { OfficerCard, SupervisorCard } from "../components/LocalOfficials.jsx";

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
      <h2>{tr("Countywide elected officials", "Funcionarios elegidos en todo el condado")}</h2>
      <ul className="cards">{data.officers.map((o) => <OfficerCard key={o.office} o={o} county={data.county} />)}</ul>
      <p className="notice">{tr("City councils, votes and campaign money for county officials aren't on Civic Atlas yet.", "Los concejos municipales, los votos y los fondos de campaña de los funcionarios del condado aún no están en Civic Atlas.")}</p>
      <p className="fine">
        {tr(`Sources (checked ${date(data.checked)}): `, `Fuentes (verificadas el ${date(data.checked)}): `)}
        {data.sources.map((s, i) => <span key={s.url}>{i ? "; " : ""}<a href={s.url} rel="noopener">{s.label}</a></span>)}.
      </p>
    </main>
  );
}
