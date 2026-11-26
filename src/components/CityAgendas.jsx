import { useEffect, useState } from "react";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { Ref } from "./Notes.jsx";

// City council meetings coming up, for the Orange County cities that publish agendas through
// Legistar's public data feed: date, time, place, the agenda, and each item as the city titled it
// (records stay in English). Cities whose sites refuse automated reading aren't listed.
export function loadCityAgendas() {
  return fetch("/data/local/ca-orange-city-agendas.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
}

function Meeting({ m }) {
  const groups = [...new Set(m.items.map((i) => i.heading ?? ""))];
  return (
    <li>
      <strong>{date(m.date)}</strong>{m.time && <>, {m.time}</>}{m.location && <span className="fine"> · {m.location}</span>}
      <div className="fine">
        {m.agenda_url ? <a href={m.agenda_url} rel="noopener">{tr("Agenda (PDF)", "Agenda (PDF)")}</a> : tr("Agenda not posted yet", "La agenda aún no se ha publicado")}
        {m.meeting_url && <> · <a href={m.meeting_url} rel="noopener">{tr("Meeting page", "Página de la reunión")}</a></>}
      </div>
      {m.items.length > 0 && (
        <details>
          <summary>{m.items.length === 1 ? tr("1 item", "1 asunto") : tr(`${m.items.length} items`, `${m.items.length} asuntos`)}</summary>
          {groups.map((g) => (
            <div key={g}>
              {g && <h4>{g}</h4>}
              <ul className="bare agenda-items">
                {m.items.filter((i) => (i.heading ?? "") === g).map((i, k) => (
                  <li key={`${i.file ?? ""}${k}`} lang="en">
                    <span className="item-no">{i.number ?? ""}</span>
                    <div>
                      {i.title}
                      <div className="fine">
                        {i.file && <>{i.file}</>}
                        {i.attachments.slice(0, 3).map((a) => <span key={a.url}>{" · "}<a href={a.url} rel="noopener">{a.name || tr("Document", "Documento")}</a></span>)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      )}
    </li>
  );
}

export default function CityAgendas({ only }) {
  const [data, setData] = useState(null);
  useEffect(() => { loadCityAgendas().then((d) => setData(d ?? false)); }, []);
  if (!data) return null;
  const cities = Object.entries(data.cities).filter(([name]) => !only || name === only);
  if (!cities.length) return null;
  return (
    <section id="city-agendas" className="county-agenda">
      <h3>{tr("Upcoming council meetings", "Próximas reuniones de concejos")}<Ref id="city-agenda-src" text={tr("From each city's Legistar agenda system, read twice a day. Items are shown as each city titled them, in English. Only cities whose agenda systems allow automated reading are listed; for the others, see each city's website below.", "Del sistema de agendas Legistar de cada ciudad, leído dos veces al día. Los asuntos se muestran como los tituló cada ciudad, en inglés. Solo se incluyen las ciudades cuyos sistemas permiten la lectura automática; para las demás, vea el sitio web de cada ciudad abajo.")} /></h3>
      {cities.map(([name, c]) => (
        <div key={name}>
          <h4>{tr(`${name} City Council`, `Concejo Municipal de ${name}`)}</h4>
          {c.meetings.length ? <ul className="bare">{c.meetings.map((m) => <Meeting key={m.date + m.time} m={m} />)}</ul>
            : <p className="fine">{tr("No council meeting posted in the next 45 days.", "No hay reuniones del concejo publicadas en los próximos 45 días.")} <a href={c.source} rel="noopener">{tr("Calendar", "Calendario")}</a></p>}
        </div>
      ))}
    </section>
  );
}
