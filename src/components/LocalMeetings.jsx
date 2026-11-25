import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { listedDates, ruleDates } from "../../lib/localMeetings.js";
import { Ref, useHasNote } from "./Notes.jsx";

// Next regular meetings of the county board and a city council, from the county's published
// schedule and the city's municipal-code rule. Special meetings and cancellations appear only on
// the official agenda pages, which each list links to.
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const clock = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return tr(`${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`, `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`);
};
const weekday = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(tr("en-US", "es-US"), { weekday: "long" });

function Body({ title, rows, time, place, posted, agendasUrl, notes, source, count, noteId }) {
  const cited = useHasNote(noteId);
  return (
    <div className="local-meetings">
      <h3>{title}{cited && <Ref id={noteId} />}</h3>
      {rows.length === 0 ? <p className="fine">{tr("No upcoming dates on the published schedule.", "No hay fechas próximas en el calendario publicado.")}</p> : (
        <ul className="plain">
          {rows.slice(0, count).map((r) => (
            <li key={r.date}>
              <strong>{weekday(r.date)}, {date(r.date)}</strong>, {clock(time)}
              {notes?.[r.date] && <> · {tr(notes[r.date].en, notes[r.date].es)}</>}
              {r.moved && <span className="fine"> · {tr("moved a day for a holiday", "movida un día por un feriado")}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="fine">
        {tr(place.en, place.es)}. {tr(posted.en, posted.es)} <a href={agendasUrl} rel="noopener">{tr("Agendas", "Agendas")}</a>
        {!cited && <>{" · "}{tr("Schedule: ", "Calendario: ")}{source}</>}
      </p>
    </div>
  );
}

export default function LocalMeetings({ data, city, count = 3, showBoard = true, heading = true }) {
  const from = today();
  const board = showBoard ? data.board_meetings : null;
  const rule = city?.meeting_rule;
  if (!board && !rule) return null;
  return (
    <section className="meetings-block">
      {heading && <h2>{tr("Upcoming public meetings", "Próximas reuniones públicas")}</h2>}
      <p className="fine">{tr("Anyone can attend and speak during public comment. Regular meetings only: special meetings and cancellations are posted on each agenda page.", "Cualquier persona puede asistir y hablar durante los comentarios públicos. Solo reuniones ordinarias: las reuniones especiales y las cancelaciones se publican en cada página de agendas.")}</p>
      {rule && (
        <Body title={tr(`${city.name} City Council`, `Concejo Municipal de ${city.name}`)} rows={ruleDates(rule, from, count)} time={rule.time}
          place={rule.place} posted={rule.agendas_posted} agendasUrl={city.agendas_url} count={count} noteId={`rule-${city.id}`}
          source={<a href={rule.rule_source.url} rel="noopener">{rule.rule_source.label}</a>} />
      )}
      {board && (
        <Body title={tr(`${data.county} Board of Supervisors`, `Junta de Supervisores del Condado de ${data.county.replace(/ County$/, "")}`)} rows={listedDates(board.dates, from, count)} time={board.time}
          place={board.place} posted={board.agendas_posted} agendasUrl={data.meetings_url} notes={board.notes} count={count} noteId="schedule"
          source={board.sources.map((s, i) => <span key={s.url}>{i ? "; " : ""}<a href={s.url} rel="noopener">{s.label}</a></span>)} />
      )}
    </section>
  );
}
