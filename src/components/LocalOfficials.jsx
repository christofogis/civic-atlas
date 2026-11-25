import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { loadLocal, officeName, roleName, supervisorSeat, termEnded } from "../lib/local.js";

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
  return (
    <>
      <h2>{data.county}</h2>
      {approximate && sup && <p className="notice">{tr("The supervisor district is based on the center of this location. A full street address gives an exact match.", "El distrito de supervisor se basa en el centro de este lugar. Una dirección completa da un resultado exacto.")}</p>}
      <ul className="cards">
        {sup && <SupervisorCard s={sup} county={data.county} />}
        {data.officers.map((o) => <OfficerCard key={o.office} o={o} county={data.county} />)}
      </ul>
      <p className="fine">
        {tr("City council members aren't on Civic Atlas yet. ", "Los miembros de los concejos municipales aún no están en Civic Atlas. ")}
        <Link to={`/local/${local.id}`}>{tr(`All ${data.county} officials`, `Todos los funcionarios del ${data.county}`)}</Link>
      </p>
    </>
  );
}
