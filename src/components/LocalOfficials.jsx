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
  const member = city?.members.find((m) => m.district === local.city.council_district);
  const place = local.place;
  return (
    <>
      {approximate && sup && <p className="notice">{tr("The supervisor district is based on the center of this location. A full street address gives an exact match.", "El distrito de supervisor se basa en el centro de este lugar. Una dirección completa da un resultado exacto.")}</p>}
      {city && (
        <>
          <h2>{tr(`City of ${city.name}`, `Ciudad de ${city.name}`)}</h2>
          <ul className="cards">{member && <CouncilCard m={member} city={city} />}</ul>
          <p className="fine">
            <Link to={`/local/${local.id}#${city.id}`}>{tr(`Whole ${city.name} City Council`, `Todo el Concejo Municipal de ${city.name}`)}</Link>
          </p>
        </>
      )}
      <h2 >{data.county}</h2>
      <ul className="cards">
        {sup && <SupervisorCard s={sup} county={data.county} />}
        {data.officers.map((o) => <OfficerCard key={o.office} o={o} county={data.county} />)}
      </ul>
      <p className="fine">
        {!city && place?.type === "unincorporated" && (place.name
          ? tr(`This address is in ${place.name}, an unincorporated community: it has no city council, and the Board of Supervisors governs local matters. `, `Esta dirección está en ${place.name}, una comunidad no incorporada: no tiene concejo municipal, y la Junta de Supervisores gobierna los asuntos locales. `)
          : tr("This address is in an unincorporated area: it has no city council, and the Board of Supervisors governs local matters. ", "Esta dirección está en una zona no incorporada: no tiene concejo municipal, y la Junta de Supervisores gobierna los asuntos locales. "))}
        {!city && place?.type === "city" && tr(`${place.name}'s city council isn't on Civic Atlas yet. `, `El concejo municipal de ${place.name} aún no está en Civic Atlas. `)}
        <Link to={`/local/${local.id}`}>{tr(`All ${data.county} officials`, `Todos los funcionarios del ${data.county}`)}</Link>
      </p>
    </>
  );
}
