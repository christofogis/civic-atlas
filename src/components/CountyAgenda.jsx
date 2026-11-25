import { useEffect, useState } from "react";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { Ref } from "./Notes.jsx";

// What the Board of Supervisors will take up at its next meeting, item by item, in the county's
// own words (records stay in English as published). Items can be narrowed to those that name one
// supervisor district; items for all districts are always included. Nothing is summarized or
// characterized: number, department, the printed description, the districts it names, any status
// the Clerk added, and the link to the item's files.

export function loadAgendas() {
  return fetch("/data/local/ca-orange-agendas.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
}

// Items that name this district, or all districts.
export const forDistrict = (items, d) => items.filter((i) => i.districts === "all" || (Array.isArray(i.districts) && i.districts.includes(d)));
export const onlyDistrict = (items, d) => items.filter((i) => Array.isArray(i.districts) && i.districts.includes(d));

const SECTION = {
  "Consent Calendar": ["Consent calendar: approved together in one vote unless a supervisor pulls an item", "Calendario de consentimiento: se aprueban juntos en una sola votación, salvo que un supervisor separe un asunto"],
  "Discussion Items": ["Discussion items", "Asuntos para discusión"],
  "Public Hearings": ["Public hearings", "Audiencias públicas"],
  "Closed Session": ["Closed session: private, as state law allows for labor talks, lawsuits and some other matters", "Sesión a puerta cerrada: privada, como permite la ley estatal para negociaciones laborales, demandas y otros asuntos"],
};

function districtsLabel(d) {
  if (d === "all") return tr("All districts", "Todos los distritos");
  if (Array.isArray(d)) return d.length === 1 ? tr(`District ${d[0]}`, `Distrito ${d[0]}`) : tr(`Districts ${d.join(", ")}`, `Distritos ${d.join(", ")}`);
  return null;
}

export default function CountyAgenda({ district }) {
  const [data, setData] = useState(null);
  const [mine, setMine] = useState(false);
  useEffect(() => { loadAgendas().then((d) => setData(d ?? false)); }, []);
  if (data === null) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
  const m = data && data.meetings.find((x) => x.date >= today && x.items.length);
  if (!m) return null;
  const shown = mine && district ? forDistrict(m.items, district) : m.items;
  const sections = [...new Set(shown.map((i) => i.section))];
  const own = district ? onlyDistrict(m.items, district).length : 0;
  return (
    <section id="agenda" className="county-agenda">
      <h2>{tr(`On the agenda: ${date(m.date)}`, `En la agenda: ${date(m.date)}`)}<Ref id="agenda-src" text={<>{tr("From the agenda the Clerk of the Board publishes, ", "De la agenda que publica la Secretaría de la Junta, ")}{m.agenda_updated && tr(`last updated ${date(m.agenda_updated)}, `, `actualizada por última vez el ${date(m.agenda_updated)}, `)}<a href={m.agenda_url}>{tr("agenda (PDF)", "agenda (PDF)")}</a>{tr(". Each item is shown as printed, in English. Agendas post on Wednesdays two weeks before the meeting, with changes the Friday before; checked twice a day.", ". Cada asunto se muestra como fue publicado, en inglés. Las agendas se publican los miércoles dos semanas antes de la reunión, con cambios el viernes anterior; se revisan dos veces al día.")}</>} /></h2>
      <p>
        {tr(`${m.items.length} items`, `${m.items.length} asuntos`)}
        {district ? tr(`, ${own} naming District ${district} specifically.`, `, ${own} mencionan específicamente el Distrito ${district}.`) : "."}
        {" "}{m.register_url && <a href={m.register_url} rel="noopener">{tr("Register to speak", "Inscribirse para hablar")}</a>}
        {m.video_url && <> · <a href={m.video_url} rel="noopener">{tr("Watch live", "Ver en vivo")}</a></>}
      </p>
      {district && (
        <div className="seg-toggle" role="group" aria-label={tr("Show", "Mostrar")}>
          <button type="button" aria-pressed={!mine} onClick={() => setMine(false)}>{tr("All items", "Todos los asuntos")}</button>
          <button type="button" aria-pressed={mine} onClick={() => setMine(true)}>{tr(`District ${district} and countywide`, `Distrito ${district} y todo el condado`)}</button>
        </div>
      )}
      <details key={String(mine)} open={mine || undefined}>
        <summary>{mine ? tr(`Show the ${shown.length} items`, `Ver los ${shown.length} asuntos`) : tr(`Show all ${shown.length} items`, `Ver los ${shown.length} asuntos`)}</summary>
        {sections.map((s) => (
          <div key={s}>
            <h3>{SECTION[s] ? tr(...SECTION[s]) : s}</h3>
            <ul className="plain agenda-items">
              {shown.filter((i) => i.section === s).map((i) => (
                <li key={i.number} lang="en">
                  <span className="item-no">{i.number}</span>
                  <div>
                    {i.status && <span className="status-flag">{i.status}</span>} {i.text}
                    <div className="fine">
                      {districtsLabel(i.districts)}
                      {i.files_url && <>{i.districts ? " · " : ""}<a href={i.files_url} rel="noopener">{tr("Staff report and documents", "Informe y documentos")}</a></>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </section>
  );
}
