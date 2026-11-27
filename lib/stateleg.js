// Matching state legislative districts between Open States ("3rd Suffolk", "Windsor-3-2", "039")
// and Geocodio's OCD division IDs ("ocd-division/country:us/state:ma/sldl:3rd_suffolk").
// Lowercase, ordinal words as numbers ("Third Suffolk" = "3rd Suffolk"; Massachusetts uses both),
// letters and digits only, leading zeros dropped from each number.
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];
const SUFFIX = (n) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");
export const districtKey = (s) => {
  if (s == null) return null;
  return String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    .map((w) => { const i = ORDINALS.indexOf(w); return i < 0 ? w : `${i + 1}${SUFFIX(i + 1)}`; })
    .map((w) => w.replace(/^0+(\d)/, "$1"))
    .join("");
};

// Geocodio's `stateleg` field -> { upper: [keys], lower: [keys] }, current districts only,
// largest overlap first. Nebraska's single chamber comes back as "senate".
export function stateDistrictsFromGeocodio(json) {
  const f = json?.results?.[0]?.fields?.state_legislative_districts;
  if (!f) return { upper: [], lower: [] };
  const keys = (list) => [...new Set((list ?? [])
    .filter((d) => !d.is_upcoming_state_legislative_district)
    .sort((a, b) => (b.proportion ?? 1) - (a.proportion ?? 1))
    .map((d) => districtKey((d.ocd_id ?? "").split(":").pop() || d.district_number))
    .filter(Boolean))];
  return { upper: keys(f.senate), lower: keys(f.house) };
}

// Statewide offices shown for every state. Open States lists these consistently; other elected
// statewide offices (treasurer, controller, ...) appear for only a few states, so they're left
// out until every state has them.
export const STATEWIDE = ["governor", "lt_governor", "attorney general", "secretary of state", "chief election officer"];

// The address's legislative districts with nobody listed in them (a vacancy, or a new member Open
// States hasn't added yet), so the lookup can say so instead of leaving the seat out. Only districts
// with no one at all are reported; Nebraska's (and D.C.'s) single chamber is "legislature".
export function emptySeats(st, officials, districts) {
  const upperType = st === "NE" || st === "DC" ? "legislature" : "upper";
  const held = (types, key) => (officials ?? []).some((o) => types.includes(o.type) && districtKey(o.district) === key);
  return [
    ...(districts?.upper ?? []).filter((k) => !held(["upper", "legislature"], k)).map((key) => ({ type: upperType, key })),
    ...(districts?.lower ?? []).filter((k) => !held(["lower"], k)).map((key) => ({ type: "lower", key })),
  ];
}

// A state role covers a day from its start through the day before its end. Open States' end date
// for statewide offices is the day the next term begins (Newsom 2019 term: ends 2023-01-02, the
// day the 2023 term starts), and for legislators sometimes that day, sometimes the day before;
// treating it as the first day not served never shows someone past their term, at worst a day early.
export const isCurrentStateRole = (r, today) =>
  (!r.start_date || r.start_date <= today) && (!r.end_date || r.end_date > today);

// First Monday in December of a year, YYYY-MM-DD.
export function firstMondayOfDecember(year) {
  const dec1 = new Date(Date.UTC(year, 11, 1)).getUTCDay();
  return `${year}-12-${String(1 + ((8 - dec1) % 7)).padStart(2, "0")}`;
}

// Legislative term calendars, for states whose Open States records give no end dates for the
// sitting members' terms (re-elected members keep one open-ended role; most departing members get
// an end date only once the repository is updated after the term starts). Only states listed here
// are checked against a calendar; everywhere else, end dates in the data decide. Add a state only
// with the constitutional rule cited.
export const TERM_CALENDARS = {
  // California Constitution, Article IV, section 2(a): 80 Assembly members elected every two years;
  // 40 Senators for four-year terms, 20 beginning every two years (even-numbered districts in
  // gubernatorial years such as 2026, odd-numbered in presidential years such as 2024); terms
  // "commence on the first Monday in December next following" the election.
  CA: {
    source: "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CONS&sectionNum=SEC.%202.&article=IV",
    roster: { lower: "https://www.assembly.ca.gov/assemblymembers", upper: "https://www.senate.ca.gov/senators" },
    up: (type, district, year) => year % 2 === 0 && (type === "lower" ||
      (type === "upper" && /^\d+$/.test(district ?? "") && Number(district) % 2 === (year % 4 === 2 ? 0 : 1))),
    termStart: firstMondayOfDecember,
  },
};

// The most recent day, on or before `today`, a new term began in this seat by the state's
// calendar; null for states without one.
export function calendarTermStart(state, type, district, today) {
  const cal = TERM_CALENDARS[state];
  if (!cal) return null;
  const key = districtKey(district);
  const y = Number(today.slice(0, 4));
  for (let year = y; year >= y - 4; year--) {
    if (!cal.up(type, key, year)) continue;
    const start = cal.termStart(year);
    if (start <= today) return start;
  }
  return null;
}

export const rosterFor = (state, type) => TERM_CALENDARS[state]?.roster?.[type] ?? null;

const daysBefore = (ymd, n) => new Date(Date.parse(`${ymd}T00:00:00Z`) - n * 864e5).toISOString().slice(0, 10);

// Who to show in each legislative seat of an address on `today`, from Open States roles.
//   roles: [{ id, name, party, active, type, district, district_key, start_date, end_date }]
//          every role (past and present) in the address's districts
//   refreshed: Set of `${type}|${termStart}` for chambers where Open States lists anyone whose
//          role began on or after that term start (the repository has been updated for the new term)
// Returns holders (role rows) and, for a seat whose term has ended with no newer record,
// { updating: true, type, district, term_began | term_ended, roster }: never the previous holder.
// A seat on a term calendar whose new term has begun shows its listed holder only once that
// chamber has been updated in Open States; a re-elected member keeps their earlier role there.
export function resolveLegislativeSeats({ state, today, roles, refreshed = new Set() }) {
  const seats = new Map();
  for (const r of roles ?? []) {
    const k = `${r.type}|${r.district_key ?? districtKey(r.district)}`;
    if (!seats.has(k)) seats.set(k, []);
    seats.get(k).push(r);
  }
  const out = [];
  for (const list of seats.values()) {
    const { type, district } = list[0];
    const active = list.filter((r) => r.active !== false && isCurrentStateRole(r, today));
    const termBegan = calendarTermStart(state, type, district, today);
    if (termBegan) {
      const fresh = active.filter((r) => r.start_date && r.start_date >= termBegan);
      if (fresh.length) { out.push(...fresh); continue; }
      if (active.length && refreshed.has(`${type}|${termBegan}`)) { out.push(...active); continue; }
      // Nobody on record at all, long after the term began: leave it to the empty-seat notice.
      if (!active.length && !list.some((r) => r.end_date && r.end_date >= daysBefore(termBegan, 30))) continue;
      out.push({ id: null, name: "", party: null, type, district, updating: true, term_began: termBegan, roster: rosterFor(state, type) });
      continue;
    }
    out.push(...active);
    // A role that ended in the last 120 days with no one starting in the seat since: updating.
    // (Several members can share a district, as in New Hampshire, so this is per ended role.)
    const since = daysBefore(today, 120);
    for (const r of list) {
      if (!r.end_date || r.end_date > today || r.end_date < since) continue;
      if (active.some((a) => a.start_date && a.start_date >= daysBefore(r.end_date, 30))) continue;
      out.push({ id: null, name: "", party: null, type, district, updating: true, term_ended: r.end_date, roster: rosterFor(state, type) });
    }
  }
  return out;
}

// The chamber-and-term-start pairs to check for `refreshed`, for the seats of an address.
export function calendarChecks(state, seats, today) {
  const out = new Map();
  for (const { type, district } of seats) {
    const t = calendarTermStart(state, type, district, today);
    if (t) out.set(`${type}|${t}`, { type, termStart: t });
  }
  return [...out.values()];
}

// A listed role whose seat began a new term by the state's calendar after the role started, in a
// chamber Open States hasn't updated since: the day the new term began, else null.
export function calendarStale(state, role, today, refreshed = new Set()) {
  const t = calendarTermStart(state, role.type, role.district, today);
  if (!t || (role.start_date && role.start_date >= t) || refreshed.has(`${role.type}|${t}`)) return null;
  return t;
}
