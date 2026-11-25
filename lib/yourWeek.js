// "Your week": what's coming up for the officials at one set of districts, at every level, as a
// list of dated items. Shared by the page (src/pages/YourWeek.jsx) and its calendar feed
// (functions/api/calendar/week.js), so both always show the same items with the same wording.
// Every visitor gets the same kinds of items worded the same way; nothing here is about a party.
//
// deps: { rest(path) -> rows (Supabase REST, read-only), json(path) -> parsed site file,
//         tr(en, es) -> text in the visitor's language }
import { listedDates, ruleDates } from "./localMeetings.js";

const iso = (d) => d.toISOString().slice(0, 10);
const firstMondayOfDecember = (y) => { const d = new Date(Date.UTC(y, 11, 1)); d.setUTCDate(1 + ((8 - d.getUTCDay()) % 7)); return iso(d); };
const isMine = (committeeId, mine) => committeeId && (mine.has(committeeId) || mine.has(committeeId.slice(0, 4)));

// "2:00 PM" or "18:00" -> [18, 0]
export function clock(t) {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])M/i.exec(t ?? "");
  if (m) return [(+m[1] % 12) + (/p/i.test(m[3]) ? 12 : 0), +m[2]];
  const h = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  return h ? [+h[1], +h[2]] : null;
}

export const todayLA = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());

const STATE_NAMES = { CA: "California" };
const onlyDistrict = (items, d) => items.filter((i) => Array.isArray(i.districts) && i.districts.includes(d));

// result: the /api/officials body for these districts. params: URLSearchParams of the districts.
export async function weekItems({ result, params, days = 45, deps }) {
  const { rest, json, tr } = deps;
  const today = todayLA(), until = iso(new Date(Date.now() + days * 864e5));
  const list = [];
  const add = (key, d, time, tz, level, text, to, url) => { if (d >= today && d <= until) list.push({ key, date: d, time, tz, level, text, to, url }); };
  const co = params.get("co");
  const ids = (result.officials ?? []).map((o) => o.bioguide_id);

  // Congress: hearings and meetings of your members' committees, the House floor week, and when
  // each chamber next meets.
  const [cm, ev] = await Promise.all([
    ids.length ? rest(`committee_memberships?bioguide_id=in.(${ids.join(",")})&select=bioguide_id,committee_id,congress`).catch(() => []) : [],
    rest(`upcoming_events?event_date=gte.${today}&order=event_date&limit=400&select=event_id,kind,event_date,event_time,chamber,committee_id,committee_name,title,source_url`).catch(() => []),
  ]);
  const top = Math.max(0, ...cm.map((c) => c.congress));
  const mine = new Set(cm.filter((c) => c.congress === top).map((c) => c.committee_id));
  const KIND = { hearing: ["Hearing", "Audiencia"], markup: ["Markup", "Sesión de enmiendas"], meeting: ["Meeting", "Reunión"] };
  for (const e of ev) {
    if (KIND[e.kind] && isMine(e.committee_id, mine)) {
      add(`ev-${e.event_id}`, e.event_date, e.event_time, "America/New_York", "congress", `${tr(...KIND[e.kind])}: ${e.committee_name}${e.title ? `: ${e.title}` : ""}`, e.event_id ? `/hearing/${e.event_id}` : null, e.source_url);
    }
  }
  const floorWeek = ev.find((e) => e.kind === "floor");
  if (floorWeek && (result.officials ?? []).some((o) => o.chamber === "house")) {
    const n = ev.filter((e) => e.kind === "floor" && e.event_date === floorWeek.event_date).length;
    add("floor", floorWeek.event_date, null, "America/New_York", "congress", tr(`House floor schedule for the week: ${n} item${n === 1 ? "" : "s"}`, `Agenda del pleno de la Cámara para la semana: ${n} asunto${n === 1 ? "" : "s"}`), "/week#floor", "https://docs.house.gov/floor/");
  }
  for (const e of ev.filter((x) => x.kind === "convene")) {
    add(`convene-${e.chamber}-${e.event_date}`, e.event_date, e.event_time, "America/New_York", "congress", e.chamber === "senate" ? tr("The Senate meets", "El Senado se reúne") : tr("The House meets", "La Cámara se reúne"), "/week", e.source_url);
  }
  add("c120", "2027-01-03", null, "America/New_York", "congress", tr("The 120th Congress begins; new terms for House members and a third of senators", "Comienza el 120.º Congreso; nuevos períodos para los miembros de la Cámara y un tercio de los senadores"), "/week", null);

  // State (California): the Legislature's session start and new terms for statewide offices.
  if (result.state === "CA") {
    const y = +today.slice(0, 4);
    for (const yr of [y, y + 1]) if (yr % 2 === 0) add(`leg-${yr}`, firstMondayOfDecember(yr), "12:00", "America/Los_Angeles", "state", tr(`The California Legislature begins its ${yr + 1}–${String(yr + 2).slice(2)} session`, `La Legislatura de California comienza su sesión ${yr + 1}–${String(yr + 2).slice(2)}`), null, "https://law.justia.com/constitution/california/article-iv/section-3/");
    const st = await json("/data/state/ca-statewide.json").catch(() => null);
    if (st?.seat_change_by) add("ca-terms", st.seat_change_by, null, "America/Los_Angeles", "state", tr("New terms begin for California's statewide offices and Board of Equalization", "Comienzan nuevos períodos para los cargos estatales de California y la Junta de Igualación"), null, null);
  }

  // County and city: public meetings (with agenda counts once posted) and new terms for your seats.
  const local = co ? await json(`/data/local/${co}.json`).catch(() => null) : null;
  if (local) {
    const sd = result.local?.supervisor_district;
    const countyEs = local.county.replace(/ County$/, "");
    const agendas = co === "ca-orange" ? await json("/data/local/ca-orange-agendas.json").catch(() => null) : null;
    for (const m of listedDates(local.board_meetings?.dates ?? [], today, 6)) {
      const ag = agendas?.meetings?.find((x) => x.date === m.date && x.items.length);
      const own = ag && sd ? onlyDistrict(ag.items, sd).length : 0;
      const extra = ag ? tr(`: ${ag.items.length} items on the agenda${sd ? `, ${own} naming District ${sd}` : ""}`, `: ${ag.items.length} asuntos en la agenda${sd ? `, ${own} mencionan el Distrito ${sd}` : ""}`) : "";
      add(`bos-${m.date}`, m.date, local.board_meetings.time, "America/Los_Angeles", "county", tr(`${local.county} Board of Supervisors meeting`, `Reunión de la Junta de Supervisores del Condado de ${countyEs}`) + extra, `/local/${co}${ag ? "#agenda" : ""}`, local.meetings_url);
    }
    const sup = (local.supervisors ?? []).find((s) => s.district === sd);
    if (sup?.term_end) add("sup-term", sup.term_end, null, "America/Los_Angeles", "county", tr(`New term begins for your supervisor's seat (District ${sd})`, `Comienza un nuevo período para el escaño de su supervisor (Distrito ${sd})`), null, null);
    const cityId = result.local?.city?.id, cityName = result.local?.city?.name;
    const city = (local.cities ?? []).find((c) => c.id === cityId);
    if (city?.meeting_rule) {
      for (const m of ruleDates(city.meeting_rule, today, 3)) add(`cc-${m.date}`, m.date, city.meeting_rule.time, "America/Los_Angeles", "city", tr(`${city.name} City Council meeting`, `Reunión del Concejo Municipal de ${city.name}`), `/local/${co}#${city.id}`, city.agendas_url);
    } else if (cityName && co === "ca-orange") {
      // Cities that publish through Legistar: their posted council meetings and item counts.
      const ca = await json("/data/local/ca-orange-city-agendas.json").catch(() => null);
      for (const m of ca?.cities?.[cityName]?.meetings ?? []) {
        const c = clock(m.time);
        const n = m.items.length;
        add(`cc-${m.date}`, m.date, c ? `${c[0]}:${String(c[1]).padStart(2, "0")}` : null, "America/Los_Angeles", "city",
          tr(`${cityName} City Council meeting${n ? `: ${n} item${n === 1 ? "" : "s"} on the agenda` : ""}`, `Reunión del Concejo Municipal de ${cityName}${n ? `: ${n} asunto${n === 1 ? "" : "s"} en la agenda` : ""}`),
          `/local/${co}#city-agendas`, m.meeting_url);
      }
    }
    const seat = (city?.members ?? []).find((m) => m.district === result.local?.city?.council_district && m.seat_change_by);
    if (seat) add("cc-seat", seat.seat_change_by, null, "America/Los_Angeles", "city", tr(`${city.name} City Council seats newly elected in November are filled; a new mayor is chosen`, `Se ocupan los escaños del Concejo Municipal de ${city.name} elegidos en noviembre; se elige nueva alcaldía`), null, null);
  }
  list.sort((a, z) => a.date.localeCompare(z.date) || (clock(a.time)?.[0] ?? 99) - (clock(z.time)?.[0] ?? 99));
  return list;
}

// The items as an iCalendar feed. Each event links back to its page on the site.
export function weekIcs({ items, name, origin, stamp = new Date() }) {
  const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const fold = (line) => line.match(/.{1,74}/g).join("\r\n ");
  const dtstamp = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Civic Atlas//Your week//EN", "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:America/Los_Angeles", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", "X-PUBLISHED-TTL:PT6H"];
  for (const it of items) {
    const d = it.date.replace(/-/g, "");
    const c = clock(it.time);
    lines.push("BEGIN:VEVENT", `UID:${it.key.replace(/[^a-z0-9-]/gi, "")}-${d}@civic-atlas`, `DTSTAMP:${dtstamp}`);
    if (c) {
      const hh = String(c[0]).padStart(2, "0"), mm = String(c[1]).padStart(2, "0"), end = String(Math.min(23, c[0] + 1)).padStart(2, "0");
      lines.push(`DTSTART;TZID=${it.tz}:${d}T${hh}${mm}00`, `DTEND;TZID=${it.tz}:${d}T${end}${mm}00`);
    } else {
      const next = new Date(`${it.date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${iso(next).replace(/-/g, "")}`);
    }
    const page = it.to ? origin + it.to : origin + "/your-week";
    lines.push(fold(`SUMMARY:${esc(it.text)}`), fold(`DESCRIPTION:${esc(`${page}${it.url ? `\nSource: ${it.url}` : ""}`)}`), fold(`URL:${page}`), "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
