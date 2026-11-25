// Upcoming local meetings from published schedules. County boards publish a list of dates;
// city councils often set a rule in their municipal code (e.g. "third Monday; on a legal
// holiday, the next business day"), which we expand into dates.

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, day) => new Date(Date.UTC(y, m, day));

// nth weekday (0 = Sunday) of a month, 1-based month index 0..11.
export function nthWeekday(year, month, weekday, nth) {
  const first = utc(year, month, 1).getUTCDay();
  return utc(year, month, 1 + ((weekday - first + 7) % 7) + 7 * (nth - 1));
}

// Federal holidays that fall on a Monday by rule (the ones a "Monday meeting" can hit), plus
// fixed-date holidays when they land on a weekday.
export function holidays(year) {
  const fixed = [[0, 1], [5, 19], [6, 4], [10, 11], [11, 25]].map(([m, d]) => iso(utc(year, m, d)));
  return new Set([
    ...fixed,
    iso(nthWeekday(year, 0, 1, 3)),  // Martin Luther King Jr. Day
    iso(nthWeekday(year, 1, 1, 3)),  // Presidents' Day
    iso(nthWeekday(year, 8, 1, 1)),  // Labor Day
    iso(nthWeekday(year, 9, 1, 2)),  // Columbus Day / Indigenous Peoples' Day
    iso(utc(year, 4, 31 - ((utc(year, 4, 31).getUTCDay() + 6) % 7))), // Memorial Day
  ]);
}

// Dates for a rule like { nth: 3, weekday: 1 } from `from` (YYYY-MM-DD) for `count` meetings.
export function ruleDates(rule, from, count = 3) {
  const out = [];
  let [y, m] = from.split("-").map(Number);
  m -= 1;
  for (let i = 0; out.length < count && i < 24; i++, m++) {
    if (m > 11) { m = 0; y++; }
    let d = nthWeekday(y, m, rule.weekday, rule.nth);
    let moved = false;
    while (holidays(d.getUTCFullYear()).has(iso(d)) || [0, 6].includes(d.getUTCDay())) {
      d = utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
      moved = true;
    }
    if (iso(d) >= from) out.push({ date: iso(d), moved });
  }
  return out;
}

export const listedDates = (dates, from, count = 3) => dates.filter((d) => d >= from).slice(0, count).map((date) => ({ date }));
