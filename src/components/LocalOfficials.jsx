import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { councilRole, councilSeat, loadLocal, officeName, roleName, rolesCurrent, seatUpdating, supervisorSeat, termEnded } from "../lib/local.js";

export function SupervisorCard({ s, county }) {
  if (termEnded(s)) {
    return (
      <li className="card pending">
        <p className="seat">{supervisorSeat(county, s.district)}</p>
        <p>{tr(`A new term began on ${date(s.term_end)}. Information for this seat is being updated.`, `Un nuevo período comenzó el ${date(s.term_end)}. La información de este escaño se está actualizando.`)}</p>
      </li>
    );
  }
  return (
    <li className="card">
      <p className="seat">{supervisorSeat(county, s.district)}{s.role && <> · {roleName(s.role)}</>}</p>
      <h3><a href={s.website} rel="noopener">{s.name}</a></h3>
      <p className="meta">{tr("Nonpartisan office", "Cargo no partidista")}{s.term_end && <> · {tr("term ends", "el período termina el")} {date(s.term_end)}</>}</p>
      {s.phone && <p className="fine">{s.phone}</p>}
    </li>
  );
}

export function OfficerCard({ o, county }) {
  return (
    <li className="card">
      <p className="seat">{officeName(o.office)}, {county}</p>
      <h3>{o.name}</h3>
      <p className="meta">{tr("Nonpartisan office · elected countywide", "Cargo no partidista · elegido en todo el condado")}</p>
    </li>
  );
}

export function CouncilCard({ m, city }) {
  if (seatUpdating(m)) {
    return (
      <li className="card pending">
        <p className="seat">{councilSeat(city.name, m.district)}</p>
        <p>{tr("This seat was on the November ballot. Information for it is being updated.", "Este escaño estuvo en la boleta de noviembre. Su información se está actualizando.")}</p>
      </li>
    );
  }
  const role = rolesCurrent(city) ? councilRole(m.role) : null;
  return (
    <li className="card">
      <p className="seat">{councilSeat(city.name, m.district)}{role && <> · {role}</>}</p>
      <h3><a href={city.website} rel="noopener">{m.name}</a></h3>
      <p className="meta">{tr("Nonpartisan office", "Cargo no partidista")} · {tr(`term ends ${m.term_end_label}`, `el período termina en ${m.term_end_label.replace("November", "noviembre de")}`)}</p>
      {m.on_ballot && <p className="fine">{tr("On the November 3, 2026 ballot; results are being certified.", "En la boleta del 3 de noviembre de 2026; los resultados se están certificando.")}</p>}
    </li>
  );
}

// County officials in the lookup results.
export default function LocalOfficials({ local, approximate }) {
  const [data, setData] = useState(null);
  useEffect(() => { if (local?.covered) loadLocal(local.id).then(setData).catch(() => {}); }, [local]);
  if (!local) return null;
  if (!local.covered) {
    return <p className="fine">{tr("County and city officials are on Civic Atlas for Orange County, California only, for now.", "Por ahora, los funcionarios de condado y ciudad están en Civic Atlas solo para el Condado de Orange, California.")}</p>;
  }
  if (!data) return null;
  const sup = data.supervisors.find((s) => s.district === local.supervisor_district);
  const city = local.city && data.cities?.find((c) => c.id === local.city.id);
  const otherCity = local.city && !city ? local.city : null;
  const member = city?.members.find((m) => m.district === local.city.council_district);
  const place = local.place;
  return (
    <>
      {approximate && sup && <p className="notice">{tr("The supervisor district is based on the center of this location. A full street address gives an exact match.", "El distrito de supervisor se basa en el centro de este lugar. Una dirección completa da un resultado exacto.")}</p>}
      {(city || otherCity) && (
        <>
          <h2>{tr(`City: ${(city ?? otherCity).name}`, `Ciudad: ${(city ?? otherCity).name}`)}</h2>
          <p className="level-what">{tr("The city council sets city laws and the city budget: police and fire, streets, parks, zoning and permits.", "El concejo municipal aprueba las leyes y el presupuesto de la ciudad: policía y bomberos, calles, parques, zonificación y permisos.")}</p>
          {city && <ul className="cards">{member && <CouncilCard m={member} city={city} />}</ul>}
          <p className="fine">
            {city && <Link to={`/local/${local.id}#${city.id}`}>{tr(`Whole ${city.name} City Council`, `Todo el Concejo Municipal de ${city.name}`)}</Link>}
            {otherCity && (otherCity.council_district
              ? tr(`This address is in City Council District ${otherCity.council_district}. ${otherCity.name}'s council members aren't listed on Civic Atlas yet.`, `Esta dirección está en el distrito ${otherCity.council_district} del concejo municipal. Los miembros del concejo de ${otherCity.name} aún no aparecen en Civic Atlas.`)
              : tr(`${otherCity.name}'s council members aren't listed on Civic Atlas yet.`, `Los miembros del concejo de ${otherCity.name} aún no aparecen en Civic Atlas.`))}
          </p>
        </>
      )}
      {!city && !otherCity && place?.type === "unincorporated" && (
        <>
          <h2>{tr("No city government", "Sin gobierno municipal")}</h2>
          <p className="level-what">{place.name
            ? tr(`This address is in ${place.name}, an unincorporated community. It has no city council; the county Board of Supervisors makes local decisions here.`, `Esta dirección está en ${place.name}, una comunidad no incorporada. No tiene concejo municipal; la Junta de Supervisores del condado toma las decisiones locales aquí.`)
            : tr("This address is in an unincorporated area. It has no city council; the county Board of Supervisors makes local decisions here.", "Esta dirección está en una zona no incorporada. No tiene concejo municipal; la Junta de Supervisores del condado toma las decisiones locales aquí.")}</p>
        </>
      )}
      <h2>{tr(`County: ${data.county}`, `Condado: ${data.county}`)}</h2>
      <p className="level-what">{tr("The Board of Supervisors sets the county budget and runs county services: public health, social services, jails, elections, and local services in unincorporated areas.", "La Junta de Supervisores aprueba el presupuesto del condado y administra sus servicios: salud pública, servicios sociales, cárceles, elecciones y servicios locales en zonas no incorporadas.")}</p>
      <ul className="cards">
        {sup && <SupervisorCard s={sup} county={data.county} />}
        {data.officers.map((o) => <OfficerCard key={o.office} o={o} county={data.county} />)}
      </ul>
      <p className="fine">
        <Link to={`/local/${local.id}`}>{tr(`All ${data.county} officials`, `Todos los funcionarios del ${data.county}`)}</Link>
      </p>
    </>
  );
}
