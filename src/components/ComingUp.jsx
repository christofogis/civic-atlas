import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { date, shortCommittee } from "../lib/format.js";
import Clamp from "./Clamp.jsx";
import { Explain } from "./Explain.jsx";
import { tr, locale } from "../lib/lang.js";

const todayEastern = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const KIND = () => ({ hearing: tr("Hearing", "Audiencia"), markup: tr("Markup", "Sesión de enmiendas"), meeting: tr("Meeting", "Reunión") });
const FLOOR_GROUPS = [
  ["suspension", <>{tr("Fast-track votes (need two-thirds)", "Votaciones por vía rápida (requieren dos tercios)")} <Explain id="suspension" /></>],
  ["rule", <>{tr("Debated under a rule", "Debatidos bajo una regla")} <Explain id="rule" /></>],
  ["other", tr("Other items", "Otros asuntos")],
];
const billPath = (ref) => { const [c, t, n] = ref.split("-"); return `/bill/${c}/${t}/${n}`; };

// What Congress has scheduled: House floor items, when the Senate meets, and committee
// hearings and markups. Committees the visitor's representatives sit on are marked.
// committees=false leaves out the committee list (the Week page shows it as a calendar instead).
export default function ComingUp({ myCommittees = new Set(), floor: showFloor = true, committees: showCommittees = true }) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    const today = todayEastern();
    const weekStart = new Date(`${today}T12:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    db.from("upcoming_events").select("*")
      .gte("event_date", weekStart.toISOString().slice(0, 10))
      .order("event_date").order("event_time").limit(400)
      .then(({ data, error }) => {
        if (error) { setState({ status: "error" }); return; }
        const rows = data ?? [];
        setState({
          status: "done",
          floor: rows.filter((e) => e.kind === "floor"),
          convene: rows.find((e) => e.kind === "convene" && e.event_date >= today),
          meetings: rows.filter((e) => !["floor", "convene"].includes(e.kind) && e.event_date >= today),
        });
      });
  }, []);

  if (state.status === "loading") return <p>{tr("Loading…", "Cargando…")}</p>;
  if (state.status === "error") return <p className="notice">{tr("Couldn't load the schedule right now.", "No se pudo cargar la agenda en este momento.")}</p>;
  const { floor, convene, meetings } = state;
  const weeks = [...new Set(floor.map((e) => e.event_date))];
  // "02:00 PM" and "2:00 PM" both appear; sort by minutes after midnight, unknown times last.
  const minutes = (t) => { const m = /^(\d{1,2}):(\d{2})\s*([AP])M/i.exec(t ?? ""); return m ? ((+m[1] % 12) + (/p/i.test(m[3]) ? 12 : 0)) * 60 + +m[2] : 9999; };
  const tidy = (t) => (t ?? "").replace(/^0(\d)/, "$1");
  const byDay = [...meetings].sort((a, z) => a.event_date.localeCompare(z.event_date) || minutes(a.event_time) - minutes(z.event_time))
    .reduce((m, e) => m.set(e.event_date, [...(m.get(e.event_date) ?? []), e]), new Map());

  return (
    <>
      {showFloor && <>
      <h3 className="small">{tr("House floor", "Pleno de la Cámara")}</h3>
      {weeks.length === 0
        ? <p>{tr("The House hasn't published a floor schedule for this week or next. It usually comes out the Friday before.", "La Cámara no ha publicado la agenda del pleno para esta semana ni la próxima. Suele publicarse el viernes anterior.")}</p>
        : weeks.map((wk) => (
          <div key={wk}>
            <p><strong>{tr("Week of", "Semana del")} {date(wk)}</strong> <span className="fine">· {tr("may be considered; the schedule can change", "podría considerarse; la agenda puede cambiar")}</span></p>
            {FLOOR_GROUPS.map(([cat, label]) => {
              const items = floor.filter((e) => e.event_date === wk && e.category === cat);
              return items.length > 0 && (
                <div key={cat}>
                  <p className="fine">{label}</p>
                  <ul className="plain">
                    {items.map((e) => (
                      <li key={e.event_id}>{e.bill_refs[0] ? <Link to={billPath(e.bill_refs[0])}>{e.title.split(":")[0]}</Link> : e.title.split(":")[0]}{e.title.includes(":") && <> · {e.title.split(":").slice(1).join(":").trim()}</>}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        ))}
      <p className="fine">{tr("Source", "Fuente")}: <a href="https://docs.house.gov/floor/">{tr("House Majority Leader's floor schedule", "agenda del pleno del Líder de la Mayoría de la Cámara")}</a> (docs.house.gov).</p>

      <h3 className="small">{tr("Senate floor", "Pleno del Senado")}</h3>
      <p>{convene ? <>{tr("The Senate next meets", "El Senado se reúne de nuevo el")} {date(convene.event_date)} {tr("at", "a las")} {convene.event_time}.</> : tr("The Senate hasn't announced when it next meets.", "El Senado no ha anunciado cuándo se reúne de nuevo.")}</p>
      <p className="fine">{tr("Source", "Fuente")}: <a href="https://www.senate.gov/legislative/schedule/floor_schedule.htm">{tr("Senate floor schedule", "agenda del pleno del Senado")}</a>.</p>

      </>}
      {showCommittees && <>
      <h3 className="small">{tr("Committee hearings and markups", "Audiencias y sesiones de comités")}</h3>
      {byDay.size === 0 ? <p>{tr("None scheduled yet.", "Nada programado todavía.")}</p> : [...byDay].map(([day, list]) => (
        <div key={day}>
          <p><strong>{new Date(`${day}T12:00:00Z`).toLocaleDateString(locale(), { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}</strong></p>
          <ul className="bare events">
            {list.map((e) => (
              <li key={e.event_id} className={`event-row${myCommittees.has(e.committee_id) || myCommittees.has(e.committee_id?.slice(0, 4)) ? " mine-row" : ""}`}>
                <span className="event-time">{tidy(e.event_time)}</span>
                <span className="event-body">
                  <span className="event-meta">
                    {e.committee_id ? <Link to={`/committee/${e.committee_id}`}>{shortCommittee(e.committee_name)}</Link> : shortCommittee(e.committee_name)}
                    <span className="fine"> · {e.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")} · {KIND()[e.kind]}</span>
                    {e.status && e.status !== "Scheduled" && <strong className="fine"> · {e.status}</strong>}
                    {(myCommittees.has(e.committee_id) || myCommittees.has(e.committee_id?.slice(0, 4))) && <span className="fine"> · {tr("your representative's committee", "comité de su representante")}</span>}
                  </span>
                  <Clamp lines={1}><a href={e.source_url}>{e.title}</a></Clamp>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="fine">{tr("Sources: senate.gov hearings schedule; House committee meeting notices (docs.house.gov). Times are Eastern.", "Fuentes: agenda de audiencias de senate.gov; avisos de reuniones de comités de la Cámara (docs.house.gov). Horas en la zona del Este.")}</p>
      </>}
    </>
  );
}
