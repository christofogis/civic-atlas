// "Your 2028 ballot": every contest and statewide measure a visitor will vote on in 2028, grouped by
// election, from the districts of their last lookup (district numbers only, never an address).
// Pure: the page passes in what it loaded, so the same assembly is tested with fixtures.
//
// What decides each contest, all from data the site already keeps:
//   - President: every fourth year (20th Amendment). Holder from public/data/us-control.json.
//   - U.S. Senate: a seat is up when its senator's term ends with this cycle (onBallot), the same rule
//     as /on-the-ballot. California 2028: class 3 (Padilla, term ends Jan 3, 2029).
//   - U.S. House: every seat, on the lines of the Congress that begins the year before (120th lines
//     for 2028). A lookup made under earlier lines in a state that redrew can't say which new district
//     the visitor is in, so the page asks for a new lookup instead of guessing.
//   - California legislature: the state's term calendar in lib/stateleg.js (California Constitution,
//     Art. IV, sec. 2(a)): all 80 Assembly seats; state Senate odd-numbered districts in 2028.
//   - Orange County supervisors: term end dates in public/data/local/ca-orange.json (localOnBallot).
//   - City councils: each member's recorded term end ("November 2028"), where the city is loaded.
//   - Measures: data/measures (Secretary of State's qualified and eligible lists), by election.
// Candidates are never listed here: who is on a ballot is known only once filing closes and the
// election office certifies the list.
import { generalElectionDate, localOnBallot, onBallot, yearOfLabel } from "./upForElection.js";
import { districtKey, firstMondayOfDecember, TERM_CALENDARS } from "./stateleg.js";
import { congressOn } from "./congress.js";
import { byElection } from "./measures.js";

const FEDERAL_PHOTO = (id) => `https://unitedstates.github.io/images/congress/225x275/${id}.jpg`;
const PRESIDENT_PARTY = { D: "Democrat", R: "Republican" };

// The Congress whose House lines a general election in `year` is held on: the one that began on
// January 3 of the year before (the 120th for 2028).
export const houseCongressFor = (year) => congressOn(`${year - 1}-01-03`);

// The elections of `year` for a state, in date order. California: the statewide primary and general,
// named as the Secretary of State names them (from the measures file). Elsewhere: the federal general
// election only, since primary dates differ by state and aren't on Civic Atlas.
export function electionsFor(state, year, measures) {
  const general = generalElectionDate(year);
  if (state === "CA" && measures?.elections?.length) {
    return measures.elections.filter((e) => e.date.startsWith(`${year}-`))
      .map((e) => ({ date: e.date, name: e.name, kind: e.date === general ? "general" : "primary" }))
      .sort((a, z) => (a.date < z.date ? -1 : 1));
  }
  return [{ date: general, name: null, kind: "general" }];
}

const federalHolder = (o) => ({ id: o.bioguide_id, name: o.name, party: o.party, href: `/member/${o.bioguide_id}`, photo: FEDERAL_PHOTO(o.bioguide_id), level: "federal" });
const stateHolder = (o) => ({ id: o.id, name: o.name, party: o.party, href: o.id ? `/state/person/${o.id.replace(/^ocd-person\//, "")}` : null, photo: o.image ?? null, level: "state" });

// Contests and notes for one visitor. Returns
//   { year, state, california, elections: [{ date, name, kind, contests, measures }], notes }
// Each contest: { key, office, district, status, holders, takesOffice, primary: "top-two" |
//   "presidential" | "majority" | null, general: "if-no-majority" | null, seats }
//   status: "held" (holders listed), "updating" (new term began; data updating), "not-seated" (the
//   holder for this ballot takes office on takesOffice), "district-unknown" (new lines; look up again).
// notes: [{ key, ... }] for seats that aren't on this ballot and levels not covered.
export function assembleBallot({ params, result, today, year = 2028, measures = null, local = null, changed120 = [], presidents = [] }) {
  const p = params instanceof URLSearchParams ? params : new URLSearchParams(params ?? "");
  const state = (p.get("st") ?? result?.state ?? "").toUpperCase() || null;
  const california = state === "CA";
  const notes = [];
  const federal = [];

  // President and Vice President.
  if (year % 4 === 0) {
    const now = presidents.find((x) => x.start <= today && (!x.end || x.end > today));
    federal.push({ key: "president", office: "president", status: now ? "held" : "unknown",
      holders: now ? [{ name: now.name, party: PRESIDENT_PARTY[now.party] ?? now.party, href: null, photo: null, level: "president" }] : [],
      takesOffice: `${year + 1}-01-20`, primary: "presidential" });
  }

  // U.S. Senate: the state's senators whose terms end with this cycle.
  const officials = result?.officials ?? [];
  for (const o of officials.filter((x) => x.chamber === "senate" && x.end_date && onBallot(x, year))) {
    federal.push({ key: `us-senate-${o.bioguide_id}`, office: "us-senate", status: o.seat_status === "pending_update" ? "updating" : "held",
      holders: o.seat_status === "pending_update" ? [] : [federalHolder(o)], takesOffice: `${year + 1}-01-03`, primary: "top-two" });
  }

  // U.S. House, on the lines this election uses.
  const want = houseCongressFor(year);
  const linkCongress = /^\d{3}$/.test(p.get("cg") ?? "") ? Number(p.get("cg")) : null;
  const cds = (p.get("cd") ?? "").split(",").filter((s) => /^\d{1,2}$/.test(s)).map(Number);
  const newLines = linkCongress != null && linkCongress < want && changed120.includes(state);
  if (!state) { /* nothing to place */ } else if (newLines || !cds.length || result?.stale_districts) {
    federal.push({ key: "us-house", office: "us-house", status: "district-unknown", holders: [], linesFrom: `${year - 1}-01-03`, congress: want, primary: "top-two",
      reason: newLines ? "new-lines" : "look-up-again" });
  } else {
    const before = today < `${year - 1}-01-03`;
    for (const d of cds) {
      const o = officials.find((x) => x.chamber === "house" && (x.district === d || officials.filter((y) => y.chamber === "house").length === 1));
      const status = before ? "not-seated" : !o ? "updating" : o.seat_status === "pending_update" ? "updating" : "held";
      federal.push({ key: `us-house-${d}`, office: "us-house", district: d, status, holders: status === "held" ? [federalHolder(o)] : [],
        takesOffice: before ? `${year - 1}-01-03` : null, primary: "top-two" });
    }
  }

  const stateContests = [];
  const county = [];
  const city = [];
  if (california) {
    const cal = TERM_CALENDARS.CA;
    const so = result?.state_officials ?? [];
    const keys = (k, fallback) => (p.get(k) ? p.get(k).split(",") : fallback ?? []).map(districtKey).filter(Boolean);
    const leg = (type, key) => {
      const o = so.find((x) => x.type === type && districtKey(x.district) === key);
      // The term that ends with this election began two (Assembly) or four (Senate) years before.
      const termStart = firstMondayOfDecember(year - (type === "lower" ? 2 : 4));
      const base = { key: `${type === "lower" ? "assembly" : "state-senate"}-${key}`, office: type === "lower" ? "assembly" : "state-senate", district: key, primary: "top-two", takesOffice: null };
      if (today < termStart) return { ...base, status: "not-seated", holders: [], takesOffice: termStart };
      if (!o || o.updating) return { ...base, status: "updating", holders: [], termBegan: termStart };
      return { ...base, status: "held", holders: [stateHolder(o)] };
    };
    for (const k of keys("su", result?.state_districts?.upper)) {
      if (cal.up("upper", k, year)) stateContests.push(leg("upper", k));
      else notes.push({ key: "state-senate-not-up", district: k, next: year + 2 });
    }
    for (const k of keys("sl", result?.state_districts?.lower)) if (cal.up("lower", k, year)) stateContests.push(leg("lower", k));

    // Orange County.
    if (p.get("co") === "ca-orange" && local) {
      const sd = Number(p.get("sd")) || null;
      const s = sd && (local.supervisors ?? []).find((x) => x.district === sd);
      if (!sd) notes.push({ key: "supervisor-district-unknown" });
      else if (s && localOnBallot(s.term_end, year)) {
        county.push({ key: `supervisor-${sd}`, office: "supervisor", district: sd, status: "held", nonpartisan: true,
          holders: [{ name: s.name, party: null, href: s.website, external: true, photo: null, level: "county" }], primary: "majority" });
      } else if (s) notes.push({ key: "supervisor-not-up", district: sd, termEnd: s.term_end });
      notes.push({ key: "county-officers-unknown", url: local.results_url });

      const pl = p.get("pl");
      if (p.get("pt") === "c" && pl) {
        const c = (local.cities ?? []).find((x) => x.name === pl);
        if (!c) {
          notes.push({ key: "city-not-loaded", city: pl, url: local.city_websites?.cities?.[pl] ?? null, registrar: local.results_url });
        } else {
          const up = (c.members ?? []).filter((m) => yearOfLabel(m.term_end_label) === year);
          const cc = Number(p.get("cc")) || null;
          const byDistrict = c.elected === "by_district" && cc;
          const mine = byDistrict ? up.filter((m) => m.district === cc) : up;
          const holder = (m) => ({ name: m.name, party: null, href: c.website, external: true, photo: null, level: "city" });
          if (byDistrict && !mine.length) notes.push({ key: "council-not-up", city: c.name, district: cc });
          else if (byDistrict) city.push({ key: `council-${c.id}-${cc}`, office: "council", city: c.name, district: cc, status: "held", nonpartisan: true, holders: mine.map(holder), general: "november-only" });
          else if (mine.length) city.push({ key: `council-${c.id}`, office: "council", city: c.name, district: null, seats: mine.length, status: "held", nonpartisan: true, holders: mine.map(holder), general: "november-only" });
          else notes.push({ key: "council-not-up", city: c.name, district: null });
        }
      } else if (p.get("pt") === "u") notes.push({ key: "unincorporated", place: pl || null });
    } else {
      notes.push({ key: "local-not-covered" });
    }
  } else if (state) {
    notes.push({ key: "state-not-covered", state });
  }

  // Each election's contests, in California ballot order (Elections Code section 13109): President,
  // U.S. Senate, U.S. House, state Senate, Assembly, then nonpartisan county and city offices, then
  // measures. City councils here are elected in November. A supervisor who wins a majority in the
  // primary is elected then, so the November entry says it appears only if no one did.
  const groups = byElection(measures);
  const elections = electionsFor(state, year, measures).map((e) => {
    const primary = e.kind === "primary";
    const contests = [
      ...federal,
      ...stateContests,
      ...county.map((c) => (primary ? c : { ...c, general: "if-no-majority" })),
      ...(primary ? [] : city),
    ].map((c) => ({ ...c, primary: primary ? c.primary ?? null : null }));
    const m = california ? (groups.find((g) => g.date === e.date)?.measures ?? []) : [];
    return { ...e, contests, measures: m.map(({ id, label, title, status }) => ({ id, label, title, status })) };
  });

  return { year, state, california, elections, notes };
}
