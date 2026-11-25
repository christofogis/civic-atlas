import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { date, stateName } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { savedDistricts } from "../lib/savedDistricts.js";
import { loadLocal } from "../lib/local.js";
import { listedDates, ruleDates } from "../../lib/localMeetings.js";
import MyReps from "../components/MyReps.jsx";
import { NotesList, Ref } from "../components/Notes.jsx";

// "Your week": everything coming up for the officials from the visitor's last lookup, at every
// level, on one list (and as a calendar file), followed by what their members of Congress did in
// the last seven days. Built from the districts remembered on this device; never an address.
// Every visitor gets the same template: the same kinds of items, worded the same way.

const DAY = 864e5;
const iso = (d) => d.toISOString().slice(0, 10);
const todayLA = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const firstMondayOfDecember = (y) => { const d = new Date(Date.UTC(y, 11, 1)); d.setUTCDate(1 + ((8 - d.getUTCDay()) % 7)); return iso(d); };
const isMine = (committeeId, mine) => committeeId && (mine.has(committeeId) || mine.has(committeeId.slice(0, 4)));

// "2:00 PM" or "18:00" -> [18, 0]
function clock(t) {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])M/i.exec(t ?? "");
  if (m) return [(+m[1] % 12) + (/p/i.test(m[3]) ? 12 : 0), +m[2]];
  const h = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  return h ? [+h[1], +h[2]] : null;
}
const showTime = (t) => { const c = clock(t); if (!c) return ""; const [h, m] = c; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`; };

// A calendar file (.ics) of the list, made in the browser: nothing is sent anywhere.
function icsFile(items) {
  const esc = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Civic Atlas//Your week//EN", "CALSCALE:GREGORIAN"];
  for (const it of items) {
    const d = it.date.replace(/-/g, "");
    const c = clock(it.time);
    lines.push("BEGIN:VEVENT", `UID:${it.key.replace(/[^a-z0-9-]/gi, "")}-${d}@civic-atlas`, `DTSTAMP:${stamp}`);
    if (c) lines.push(`DTSTART;TZID=${it.tz}:${d}T${String(c[0]).padStart(2, "0")}${String(c[1]).padStart(2, "0")}00`);
    else lines.push(`DTSTART;VALUE=DATE:${d}`);
    lines.push(`SUMMARY:${esc(it.text)}`);
    if (it.url) lines.push(`URL:${it.url}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export default function YourWeek() {
  // Districts from the link (shareable, bookmarkable) or else from this device's last lookup.
  const fromLink = new URLSearchParams(window.location.search);
  fromLink.delete("lang");
  const saved = fromLink.get("st") ? fromLink.toString() : savedDistricts();
  const params = useMemo(() => new URLSearchParams(saved ?? ""), [saved]);
  const [result, setResult] = useState(null);
  const [items, setItems] = useState(null);
  const [local, setLocal] = useState(null);

  useEffect(() => {
    if (!saved) return;
    fetch(`/api/officials?${saved}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setResult).catch(() => setResult(false));
    const co = params.get("co");
    if (co) loadLocal(co).then(setLocal).catch(() => setLocal(false)); else setLocal(false);
  }, [saved, params]);

  useEffect(() => {
    if (!result || local === null) return;
    const today = todayLA(), until = iso(new Date(Date.now() + 45 * DAY));
    const ids = result.officials.map((o) => o.bioguide_id);
    (async () => {
      const list = [];
      const add = (key, d, time, tz, level, text, to, url) => { if (d >= today && d <= until) list.push({ key, date: d, time, tz, level, text, to, url }); };
      // Congress: hearings and meetings of your members' committees, the House floor week, and
      // when each chamber next meets.
      const [{ data: cm }, { data: ev }] = await Promise.all([
        db.from("committee_memberships").select("bioguide_id,committee_id,congress").in("bioguide_id", ids),
        db.from("upcoming_events").select("event_id,kind,event_date,event_time,chamber,committee_id,committee_name,title,source_url").gte("event_date", today).order("event_date").limit(400),
      ]);
      const top = Math.max(0, ...(cm ?? []).map((c) => c.congress));
      const mine = new Set((cm ?? []).filter((c) => c.congress === top).map((c) => c.committee_id));
      for (const e of ev ?? []) {
        if (["hearing", "markup", "meeting"].includes(e.kind) && isMine(e.committee_id, mine)) {
          const what = { hearing: ["Hearing", "Audiencia"], markup: ["Markup", "Sesión de enmiendas"], meeting: ["Meeting", "Reunión"] }[e.kind];
          add(`ev-${e.event_id}`, e.event_date, e.event_time, "America/New_York", "congress", `${tr(...what)}: ${e.committee_name}${e.title ? `: ${e.title}` : ""}`, e.event_id ? `/hearing/${e.event_id}` : null, e.source_url);
        }
      }
      const floorWeek = (ev ?? []).find((e) => e.kind === "floor");
      if (floorWeek && result.officials.some((o) => o.chamber === "house")) {
        const n = (ev ?? []).filter((e) => e.kind === "floor" && e.event_date === floorWeek.event_date).length;
        add("floor", floorWeek.event_date, null, "America/New_York", "congress", tr(`House floor schedule for the week: ${n} item${n === 1 ? "" : "s"}`, `Agenda del pleno de la Cámara para la semana: ${n} asunto${n === 1 ? "" : "s"}`), "/week#floor", "https://docs.house.gov/floor/");
      }
      for (const e of (ev ?? []).filter((x) => x.kind === "convene")) {
        add(`convene-${e.chamber}`, e.event_date, e.event_time, "America/New_York", "congress", e.chamber === "senate" ? tr("The Senate meets", "El Senado se reúne") : tr("The House meets", "La Cámara se reúne"), "/week", e.source_url);
      }
      add("c120", "2027-01-03", null, "America/New_York", "congress", tr("The 120th Congress begins; new terms for House members and a third of senators", "Comienza el 120.º Congreso; nuevos períodos para los miembros de la Cámara y un tercio de los senadores"), "/week", null);

      // State (California): the Legislature's session start and new terms for statewide offices.
      if (result.state === "CA") {
        const y = +today.slice(0, 4);
        for (const yr of [y, y + 1]) if (yr % 2 === 0) add(`leg-${yr}`, firstMondayOfDecember(yr), "12:00", "America/Los_Angeles", "state", tr(`The California Legislature begins its ${yr + 1}–${String(yr + 2).slice(2)} session`, `La Legislatura de California comienza su sesión ${yr + 1}–${String(yr + 2).slice(2)}`), null, "https://law.justia.com/constitution/california/article-iv/section-3/");
        const st = await fetch("/data/state/ca-statewide.json").then((r) => r.json()).catch(() => null);
        if (st?.seat_change_by) add("ca-terms", st.seat_change_by, null, "America/Los_Angeles", "state", tr("New terms begin for California's statewide offices and Board of Equalization", "Comienzan nuevos períodos para los cargos estatales de California y la Junta de Igualación"), null, null);
      }

      // County and city: the next public meetings, and new terms for your seats.
      if (local) {
        const sd = result.local?.supervisor_district;
        for (const m of listedDates(local.board_meetings?.dates ?? [], today, 6)) add(`bos-${m.date}`, m.date, local.board_meetings.time, "America/Los_Angeles", "county", tr(`${local.county} Board of Supervisors meeting`, `Reunión de la Junta de Supervisores del ${local.county}`), `/local/${local.id ?? params.get("co")}`, local.meetings_url);
        const sup = (local.supervisors ?? []).find((s) => s.district === sd);
        if (sup?.term_end) add("sup-term", sup.term_end, null, "America/Los_Angeles", "county", tr(`New term begins for your supervisor's seat (District ${sd})`, `Comienza un nuevo período para el escaño de su supervisor (Distrito ${sd})`), null, null);
        const cityId = result.local?.city?.id;
        const city = (local.cities ?? []).find((c) => c.id === cityId);
        if (city?.meeting_rule) for (const m of ruleDates(city.meeting_rule, today, 3)) add(`cc-${m.date}`, m.date, city.meeting_rule.time, "America/Los_Angeles", "city", tr(`${city.name} City Council meeting`, `Reunión del Concejo Municipal de ${city.name}`), `/local/${params.get("co")}#${city.id}`, city.agendas_url);
        const seat = (city?.members ?? []).find((m) => m.district === result.local?.city?.council_district && m.seat_change_by);
        if (seat) add("cc-seat", seat.seat_change_by, null, "America/Los_Angeles", "city", tr(`${city.name} City Council seats newly elected in November are filled; a new mayor is chosen`, `Se ocupan los escaños del Concejo Municipal de ${city.name} elegidos en noviembre; se elige nueva alcaldía`), null, null);
      }
      list.sort((a, z) => a.date.localeCompare(z.date) || (clock(a.time)?.[0] ?? 99) - (clock(z.time)?.[0] ?? 99));
      setItems(list);
    })().catch(() => setItems([]));
  }, [result, local, params]);

  const [election, setElection] = useState(null);
  useEffect(() => {
    if (params.get("st") === "CA") fetch("/data/measures/ca-2028.json").then((r) => r.json()).then((m) => setElection(m.election)).catch(() => {});
  }, [params]);

  if (!saved) {
    return (
      <main className="page">
        <h1>{tr("Your week", "Su semana")}</h1>
        <p className="lede">{tr("Look up your address once, and this page lists what's coming up for your officials at every level, from Congress to your city council, and what your members of Congress did in the last seven days.", "Busque su dirección una vez y esta página mostrará lo que viene para sus funcionarios en todos los niveles, del Congreso a su concejo municipal, y lo que hicieron sus miembros del Congreso en los últimos siete días.")}</p>
        <p><Link className="button" to="/">{tr("Look up your address", "Buscar su dirección")}</Link></p>
        <p className="fine">{tr("Only your district numbers are kept, on this device. Your address is never stored.", "Solo se guardan los números de sus distritos, en este dispositivo. Su dirección nunca se guarda.")}</p>
      </main>
    );
  }

  const where = [params.get("pl"), stateName(params.get("st"))].filter(Boolean).join(", ");
  const LEVEL = { congress: ["Congress", "Congreso"], state: ["State", "Estado"], county: ["County", "Condado"], city: ["City", "Ciudad"] };
  const byDay = (items ?? []).reduce((m, it) => m.set(it.date, [...(m.get(it.date) ?? []), it]), new Map());
  const download = () => {
    const blob = new Blob([icsFile(items)], { type: "text/calendar" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "civic-atlas-your-week.ics" });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const ids = result ? result.officials.map((o) => o.bioguide_id) : [];
  const legislators = result ? (result.state_officials ?? []).filter((o) => ["upper", "lower", "legislature"].includes(o.type) && !o.updating) : [];

  return (
    <main className="page wide your-week">
        <h1>{tr("Your week", "Su semana")}</h1>
        <p className="lede">
          {where && <>{tr(`For ${where}.`, `Para ${where}.`)} </>}
          <Link to={`/officials?${saved}`}>{tr("All your officials", "Todos sus funcionarios")}</Link>
          {" · "}<Link to={`/your-week?${saved}`}>{tr("Link to this page", "Enlace a esta página")}</Link>
          {" · "}<Link to="/">{tr("Look up another address", "Buscar otra dirección")}</Link>
        </p>
        {result === false && <p className="notice">{tr("Your officials didn't load. Reload the page to try again.", "Sus funcionarios no se cargaron. Vuelva a cargar la página.")}</p>}

        <section>
          <h2>{tr("Coming up", "Próximamente")}<Ref id="sources" text={tr("Congress: committee and floor schedules from the House and Senate, matched to the committees your members of Congress sit on. California: the state constitution (the Legislature convenes the first Monday of December in even-numbered years) and the Secretary of State. County and city: the Board of Supervisors' adopted schedule and the city's meeting rule; special meetings and cancellations are posted on each agenda page. Times are local to where the meeting is held.", "Congreso: agendas de comités y del pleno de la Cámara y el Senado, según los comités en que están sus miembros del Congreso. California: la constitución estatal (la Legislatura se reúne el primer lunes de diciembre de los años pares) y el Secretario de Estado. Condado y ciudad: el calendario adoptado por la Junta de Supervisores y la regla de reuniones de la ciudad; las reuniones especiales y cancelaciones se publican en cada página de agenda. Las horas son las del lugar de la reunión.")} /></h2>
          {items === null ? <p>{tr("Loading…", "Cargando…")}</p> : items.length === 0 ? <p>{tr("Nothing on the calendar in the next 45 days.", "Nada en el calendario en los próximos 45 días.")}</p> : (
            <>
              <ol className="plain agenda">
                {[...byDay].map(([d, list]) => (
                  <li key={d}>
                    <h3 className="agenda-day">{date(d)}</h3>
                    <ul className="plain">
                      {list.map((it) => (
                        <li key={it.key}>
                          <span className="level-tag">{tr(...LEVEL[it.level])}</span>{" "}
                          {it.time && <span className="fine">{showTime(it.time)}{it.tz === "America/New_York" ? tr(" Eastern", " (hora del Este)") : ""} · </span>}
                          {it.to ? <Link to={it.to}>{it.text}</Link> : it.url ? <a href={it.url} rel="noopener">{it.text}</a> : it.text}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
              <p><button type="button" className="button-secondary" onClick={download}>{tr("Add these to your calendar", "Agregar a su calendario")}</button> <span className="fine">{tr("A calendar file (.ics) for your phone or computer, made on this device.", "Un archivo de calendario (.ics) para su teléfono o computadora, creado en este dispositivo.")}</span></p>
            </>
          )}
          {election && <p>{tr("Next statewide election:", "Próxima elección estatal:")} <strong>{date(election)}</strong> · <Link to="/measures">{tr("Ballot measures so far", "Medidas en la boleta hasta ahora")}</Link></p>}
        </section>

        <section>
          <h2>{tr("Your members of Congress: the last 7 days", "Sus miembros del Congreso: los últimos 7 días")}</h2>
          {result && <MyReps ids={ids} embedded />}
        </section>

        {legislators.length > 0 && (
          <section>
            <h2>{tr(`Your ${stateName(result.state)} legislators`, `Sus legisladores de ${stateName(result.state)}`)}</h2>
            <ul className="plain">
              {legislators.map((o) => <li key={o.id ?? o.name}>{o.id ? <Link to={`/state/person/${o.id}`}>{o.name}</Link> : o.name}{o.party && <span className="fine"> · {o.party}</span>}</li>)}
            </ul>
            <p className="fine">{tr("State legislators' votes and bills aren't on Civic Atlas yet.", "Los votos y proyectos de los legisladores estatales aún no están en Civic Atlas.")}</p>
          </section>
        )}
        <NotesList />
    </main>
  );
}
