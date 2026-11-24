import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";
import { Explain } from "./Explain.jsx";

const todayEastern = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
const KIND = { hearing: "Hearing", markup: "Markup", meeting: "Meeting" };
const FLOOR_GROUPS = [
  ["suspension", <>Fast-track votes (need two-thirds) <Explain id="suspension" /></>],
  ["rule", <>Debated under a rule <Explain id="rule" /></>],
  ["other", "Other items"],
];
const billPath = (ref) => { const [c, t, n] = ref.split("-"); return `/bill/${c}/${t}/${n}`; };

// What Congress has scheduled: House floor items, when the Senate meets, and committee
// hearings and markups. Committees the visitor's representatives sit on are marked.
export default function ComingUp({ myCommittees = new Set() }) {
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

  if (state.status === "loading") return <p>Loading…</p>;
  if (state.status === "error") return <p className="notice">Couldn't load the schedule right now.</p>;
  const { floor, convene, meetings } = state;
  const weeks = [...new Set(floor.map((e) => e.event_date))];
  const byDay = meetings.reduce((m, e) => m.set(e.event_date, [...(m.get(e.event_date) ?? []), e]), new Map());

  return (
    <>
      <h3 className="small">House floor</h3>
      {weeks.length === 0
        ? <p>The House hasn't published a floor schedule for this week or next. It usually comes out the Friday before.</p>
        : weeks.map((wk) => (
          <div key={wk}>
            <p><strong>Week of {date(wk)}</strong> <span className="fine">· may be considered; the schedule can change</span></p>
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
      <p className="fine">Source: <a href="https://docs.house.gov/floor/">House Majority Leader's floor schedule</a> (docs.house.gov).</p>

      <h3 className="small">Senate floor</h3>
      <p>{convene ? <>The Senate next meets {date(convene.event_date)} at {convene.event_time}.</> : "The Senate hasn't announced when it next meets."}</p>
      <p className="fine">Source: <a href="https://www.senate.gov/legislative/schedule/floor_schedule.htm">Senate floor schedule</a>.</p>

      <h3 className="small">Committee hearings and markups</h3>
      {byDay.size === 0 ? <p>None scheduled yet.</p> : [...byDay].map(([day, list]) => (
        <div key={day}>
          <p><strong>{new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}</strong></p>
          <ul className="plain">
            {list.map((e) => (
              <li key={e.event_id} className={myCommittees.has(e.committee_id) || myCommittees.has(e.committee_id?.slice(0, 4)) ? "mine-row" : ""}>
                <span className="fine">{e.event_time ?? ""} · {e.chamber === "house" ? "House" : "Senate"} · {KIND[e.kind]}</span><br />
                {e.committee_id ? <Link to={`/committee/${e.committee_id}`}>{e.committee_name}</Link> : e.committee_name}: <a href={e.source_url}>{e.title}</a>
                {e.status && e.status !== "Scheduled" && <strong> ({e.status})</strong>}
                {(myCommittees.has(e.committee_id) || myCommittees.has(e.committee_id?.slice(0, 4))) && <span className="fine"> · one of your representatives sits on this committee</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="fine">Sources: senate.gov hearings schedule; House committee meeting notices (docs.house.gov). Times are Eastern.</p>
    </>
  );
}
