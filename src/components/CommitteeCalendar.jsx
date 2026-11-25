import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { shortCommittee } from "../lib/format.js";
import { tr, locale } from "../lib/lang.js";
import { meetingHeading } from "../../lib/meetings.js";
import { itemsLabel } from "../lib/meetingLabels.js";
import ComingUp from "./ComingUp.jsx";

// Committee hearings and markups as a calendar: a week with time slots (like a work calendar), a
// month with each day's meetings, or the list. All times are Eastern, as Congress publishes them.
// Past weeks and months show what happened, each meeting linking to its video and documents.
const TZ = "America/New_York";
const HOUR_PX = 66;
const BLOCK_MIN = 60;    // meetings have a start time only; each is drawn as an hour
const etFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
const et = (iso) => {
  const p = Object.fromEntries(etFmt.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute };
};
const todayEt = () => et(new Date().toISOString()).day;
const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mondayOf = (day) => { const d = new Date(`${day}T12:00:00Z`); return addDays(day, -((d.getUTCDay() + 6) % 7)); };
const dayLabel = (day, opts) => new Date(`${day}T12:00:00Z`).toLocaleDateString(locale(), { timeZone: "UTC", ...opts });
const timeLabel = (min) => new Date(Date.UTC(2000, 0, 1, Math.floor(min / 60), min % 60)).toLocaleTimeString(locale(), { timeZone: "UTC", hour: "numeric", minute: "2-digit" });

const VIEW_KEY = "civic-atlas:calendar-view";

// The first day after `after` with a committee meeting on record, for pointing past an empty week.
function useNextMeetingDay(after, enabled) {
  const [day, setDay] = useState(null);
  useEffect(() => {
    setDay(null);
    if (!enabled) return;
    db.from("committee_meetings").select("meeting_at").gt("meeting_at", `${after}T23:59:59Z`).order("meeting_at").limit(1)
      .then(({ data }) => setDay(data?.[0] ? et(data[0].meeting_at).day : null));
  }, [after, enabled]);
  return day;
}

function useMeetings(from, to) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    setRows(null);
    // A day's margin on each side, then filtered by the Eastern date.
    db.from("committee_meetings").select("event_id,chamber,meeting_at,title,meeting_type,status,committee_ids")
      .gte("meeting_at", `${addDays(from, -1)}T00:00:00Z`).lte("meeting_at", `${addDays(to, 1)}T23:59:59Z`)
      .order("meeting_at").limit(1000)
      .then(({ data }) => setRows((data ?? []).map((m) => ({ ...m, ...et(m.meeting_at) })).filter((m) => m.day >= from && m.day <= to)));
  }, [from, to]);
  return rows;
}

function useCommitteeNames() {
  const [names, setNames] = useState({});
  useEffect(() => {
    db.from("committees").select("committee_id,name").is("parent_id", null)
      .then(({ data }) => setNames(Object.fromEntries((data ?? []).map((c) => [c.committee_id, shortCommittee(c.name)]))));
  }, []);
  return names;
}

const committeeOf = (m, names) => names[m.committee_ids?.[0]?.slice(0, 4)] ?? "";
const isMine = (m, mine) => (m.committee_ids ?? []).some((c) => mine.has(c) || mine.has(c.slice(0, 4)));
const heading = (m) => meetingHeading(m.title, m.meeting_type, itemsLabel).heading;

function WeekGrid({ start, mine, onGoTo }) {
  const names = useCommitteeNames();
  const end = addDays(start, 6);
  const rows = useMeetings(start, end);
  const next = useNextMeetingDay(end, rows?.length === 0);
  const today = todayEt();
  if (!rows) return <p>{tr("Loading…", "Cargando…")}</p>;
  const weekend = rows.some((m) => [5, 6].includes((new Date(`${m.day}T12:00:00Z`).getUTCDay() + 6) % 7));
  const days = Array.from({ length: weekend ? 7 : 5 }, (_, i) => addDays(start, i));
  const timed = rows.filter((m) => m.min > 0);
  const first = Math.min(8 * 60, ...timed.map((m) => m.min));
  const last = Math.max(18 * 60, ...timed.map((m) => m.min + BLOCK_MIN));
  const startHour = Math.floor(first / 60), endHour = Math.ceil(last / 60);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  // Side-by-side lanes only where meetings overlap: each group of overlapping meetings splits
  // its own width; a meeting with nothing beside it gets the whole column.
  const placed = (day) => {
    const list = timed.filter((m) => m.day === day).sort((a, z) => a.min - z.min).map((m) => ({ ...m }));
    const out = [];
    let group = [], groupEnd = -1;
    const flush = () => {
      const lanes = [];
      for (const m of group) {
        let lane = lanes.findIndex((endMin) => endMin <= m.min);
        if (lane < 0) { lane = lanes.length; lanes.push(0); }
        lanes[lane] = m.min + BLOCK_MIN;
        out.push({ ...m, lane, lanes: lanes.length });
      }
      const n = lanes.length;
      for (const m of out.slice(out.length - group.length)) m.lanes = n;
      group = []; groupEnd = -1;
    };
    for (const m of list) {
      if (group.length && m.min >= groupEnd) flush();
      group.push(m);
      groupEnd = Math.max(groupEnd, m.min + BLOCK_MIN);
    }
    if (group.length) flush();
    return out;
  };
  return (
    <>
      <p className="fine cal-key"><span className="cal-swatch house" /> {tr("House", "Cámara")} <span className="cal-swatch senate" /> {tr("Senate", "Senado")}{mine.size > 0 && <> <span className="cal-swatch mine" /> {tr("your representatives' committees", "comités de sus representantes")}</>}</p>
      {rows.length === 0 && (
        <p className="cal-empty">
          {tr(`No committee meetings are on record for ${dayLabel(start, { month: "short", day: "numeric" })} – ${dayLabel(end, { month: "short", day: "numeric" })}.`,
            `No hay reuniones de comités registradas del ${dayLabel(start, { day: "numeric", month: "short" })} al ${dayLabel(end, { day: "numeric", month: "short" })}.`)}{" "}
          {next && (
            <button type="button" className="link" onClick={() => onGoTo(mondayOf(next))}>
              {tr(`Next meetings: week of ${dayLabel(mondayOf(next), { month: "short", day: "numeric" })}`, `Próximas reuniones: semana del ${dayLabel(mondayOf(next), { day: "numeric", month: "short" })}`)}
            </button>
          )}
        </p>
      )}
      {rows.length > 0 && <div className="cal-week" style={{ "--days": days.length }}>
        <div className="cal-corner" />
        {days.map((d) => (
          <div key={d} className={`cal-dayhead${d === today ? " today" : ""}`}>
            <span>{dayLabel(d, { weekday: "short" })}</span> <strong>{dayLabel(d, { day: "numeric" })}</strong>
          </div>
        ))}
        <div className="cal-hours" style={{ height: hours.length * HOUR_PX }}>
          {hours.map((h) => <div key={h} className="cal-hour" style={{ top: (h - startHour) * HOUR_PX }}>{timeLabel(h * 60)}</div>)}
        </div>
        {days.map((d) => (
          <div key={d} className={`cal-day${d === today ? " today" : ""}`} style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h) => <div key={h} className="cal-line" style={{ top: (h - startHour) * HOUR_PX }} />)}
            {placed(d).map((m) => (
              <Link key={m.event_id} to={`/hearing/${m.event_id}`} title={`${timeLabel(m.min)} · ${m.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")} · ${committeeOf(m, names)}\n${m.title}`}
                className={`cal-event ${m.chamber}${isMine(m, mine) ? " mine" : ""}${/postpon|cancel/i.test(m.status ?? "") ? " off" : ""}`}
                style={{ top: ((m.min - startHour * 60) / 60) * HOUR_PX + 1, height: (BLOCK_MIN / 60) * HOUR_PX - 3,
                  left: `calc(${(100 / m.lanes) * m.lane}% + 2px)`, width: `calc(${100 / m.lanes}% - 4px)` }}>
                <span className="cal-event-committee">{committeeOf(m, names) || (m.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado"))}</span>
                <span className="cal-event-title">{heading(m)}</span>
              </Link>
            ))}
          </div>
        ))}
      </div>}
      {/* Phones: the same week as a day-by-day list (a time grid is unreadable that narrow). */}
      <div className="cal-week-mobile">
        {days.filter((d) => rows.some((m) => m.day === d)).map((d) => (
          <div key={d}>
            <h3 className="small">{dayLabel(d, { weekday: "long", month: "short", day: "numeric" })}</h3>
            <ul className="bare events">
              {rows.filter((m) => m.day === d).map((m) => (
                <li key={m.event_id} className={`event-row${isMine(m, mine) ? " mine-row" : ""}`}>
                  <span className="event-time">{m.min ? timeLabel(m.min) : ""}</span>
                  <span className="event-body">
                    <span className="event-meta">{committeeOf(m, names)}<span className="fine"> · {m.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")}</span></span>
                    <Link to={`/hearing/${m.event_id}`} className="clamp" style={{ WebkitLineClamp: 1 }}>{heading(m)}</Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {rows.some((m) => m.min === 0) && <p className="fine">{tr("Some meetings have no time posted yet; they appear in the list view.", "Algunas reuniones aún no tienen hora publicada; aparecen en la vista de lista.")}</p>}
    </>
  );
}

function MonthGrid({ month, mine }) {
  const names = useCommitteeNames();
  const first = `${month}-01`;
  const gridStart = addDays(first, -new Date(`${first}T12:00:00Z`).getUTCDay());   // Sunday on or before the 1st
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const rows = useMeetings(cells[0], cells[41]);
  const [picked, setPicked] = useState(null);
  const today = todayEt();
  const byDay = useMemo(() => (rows ?? []).reduce((acc, m) => ({ ...acc, [m.day]: [...(acc[m.day] ?? []), m] }), {}), [rows]);
  if (!rows) return <p>{tr("Loading…", "Cargando…")}</p>;
  const weekdays = Array.from({ length: 7 }, (_, i) => dayLabel(addDays(gridStart, i), { weekday: "short" }));
  const show = picked ?? (byDay[today] && today.startsWith(month) ? today : null);
  return (
    <>
      <div className="cal-month" role="grid">
        {weekdays.map((w) => <div key={w} className="cal-weekday" role="columnheader">{w}</div>)}
        {cells.map((d) => {
          const list = byDay[d] ?? [];
          return (
            <button key={d} type="button" role="gridcell" aria-pressed={show === d}
              className={`cal-cell${d.startsWith(month) ? "" : " out"}${d === today ? " today" : ""}${show === d ? " on" : ""}${list.some((m) => isMine(m, mine)) ? " mine" : ""}`}
              onClick={() => setPicked(d)} disabled={list.length === 0}
              aria-label={`${dayLabel(d, { weekday: "long", month: "long", day: "numeric" })}: ${list.length} ${tr("meetings", "reuniones")}`}>
              <span className="cal-num">{dayLabel(d, { day: "numeric" })}</span>
              {list.length > 0 && <span className="cal-count">{list.length}<span className="cal-count-label"> {tr(list.length === 1 ? "meeting" : "meetings", list.length === 1 ? "reunión" : "reuniones")}</span></span>}
            </button>
          );
        })}
      </div>
      {show && byDay[show] && (
        <section className="cal-daylist">
          <h3 className="small">{dayLabel(show, { weekday: "long", month: "long", day: "numeric" })}</h3>
          <ul className="bare events">
            {byDay[show].map((m) => (
              <li key={m.event_id} className={`event-row${isMine(m, mine) ? " mine-row" : ""}`}>
                <span className="event-time">{m.min ? timeLabel(m.min) : ""}</span>
                <span className="event-body">
                  <span className="event-meta">{committeeOf(m, names)}<span className="fine"> · {m.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")}{m.meeting_type && ` · ${m.meeting_type}`}{m.status && !/^scheduled$/i.test(m.status) && ` · ${m.status}`}</span></span>
                  <Link to={`/hearing/${m.event_id}`} className="clamp" style={{ WebkitLineClamp: 1 }}>{heading(m)}</Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!show && <p className="fine">{tr("Choose a day to see its meetings.", "Elija un día para ver sus reuniones.")}</p>}
    </>
  );
}

export default function CommitteeCalendar({ mine = new Set() }) {
  const [params, setParams] = useSearchParams();
  // Week view by default on every screen (phones get it as a day-by-day list); the visitor's last
  // choice is remembered on this device.
  const saved = (() => { try { return localStorage.getItem(VIEW_KEY); } catch { return null; } })();
  const view = ["week", "month", "list"].includes(params.get("view")) ? params.get("view") : ["week", "month", "list"].includes(saved) ? saved : "week";
  const thisWeek = mondayOf(todayEt());
  const week = /^\d{4}-\d{2}-\d{2}$/.test(params.get("week") ?? "") ? mondayOf(params.get("week")) : thisWeek;
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month") : todayEt().slice(0, 7);
  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };
  const shiftMonth = (n) => { const d = new Date(`${month}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); set("month", d.toISOString().slice(0, 7)); };

  return (
    <>
      <div className="cal-bar">
        <div className="toggle" role="group" aria-label={tr("Calendar view", "Vista del calendario")}>
          {[["week", tr("Week", "Semana")], ["month", tr("Month", "Mes")], ["list", tr("List", "Lista")]].map(([k, label]) => (
            <button key={k} type="button" aria-pressed={view === k} className={view === k ? "on" : ""} onClick={() => { try { localStorage.setItem(VIEW_KEY, k); } catch { /* storage unavailable */ } set("view", k); }}>{label}</button>
          ))}
        </div>
        {view === "week" && (
          <div className="cal-nav">
            <button type="button" className="link" onClick={() => set("week", addDays(week, -7))} aria-label={tr("Previous week", "Semana anterior")}>‹</button>
            <span className="cal-range">{dayLabel(week, { month: "short", day: "numeric" })} – {dayLabel(addDays(week, 6), { month: "short", day: "numeric", year: "numeric" })}</span>
            <button type="button" className="link" onClick={() => set("week", addDays(week, 7))} aria-label={tr("Next week", "Semana siguiente")}>›</button>
            {week !== thisWeek && <button type="button" className="link fine" onClick={() => set("week", "")}>{tr("This week", "Esta semana")}</button>}
            {week === thisWeek && <button type="button" className="link fine" onClick={() => set("week", addDays(thisWeek, 7))}>{tr("Next week", "Semana siguiente")}</button>}
          </div>
        )}
        {view === "month" && (
          <div className="cal-nav">
            <button type="button" className="link" onClick={() => shiftMonth(-1)} aria-label={tr("Previous month", "Mes anterior")}>‹</button>
            <span className="cal-range">{new Date(`${month}-15T12:00:00Z`).toLocaleDateString(locale(), { timeZone: "UTC", month: "long", year: "numeric" })}</span>
            <button type="button" className="link" onClick={() => shiftMonth(1)} aria-label={tr("Next month", "Mes siguiente")}>›</button>
            {month !== todayEt().slice(0, 7) && <button type="button" className="link fine" onClick={() => set("month", "")}>{tr("This month", "Este mes")}</button>}
          </div>
        )}
      </div>
      {view === "week" && <WeekGrid start={week} mine={mine} onGoTo={(d) => set("week", d)} />}
      {view === "month" && <MonthGrid month={month} mine={mine} />}
      {view === "list" && <ComingUp myCommittees={mine} floor={false} />}
      {view !== "list" && (
        <p className="fine">
          {tr("Times are Eastern. Each meeting is drawn as one hour; the record gives only a start time. Committees post meetings about a week ahead, so later weeks fill in over time. Source: Congress.gov committee meeting records.",
            "Horas en la zona del Este. Cada reunión se dibuja como una hora; el registro solo da la hora de inicio. Los comités publican las reuniones con una semana de anticipación, así que las semanas siguientes se completan con el tiempo. Fuente: registros de reuniones de comités de Congress.gov.")}
          {mine.size > 0 && tr(" Highlighted: committees your representatives sit on.", " Resaltadas: comités de los que forman parte sus representantes.")}
        </p>
      )}
    </>
  );
}
