// Which Congress is in session on a date. A Congress runs from noon Jan 3 of an odd year to
// Jan 3 two years later (20th Amendment); the date is treated as Eastern time, and Jan 3
// itself belongs to the new Congress.
export function congressOn(date = new Date()) {
  const ymd = typeof date === "string" ? date.slice(0, 10)
    : new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date);
  const [y, m, d] = ymd.split("-").map(Number);
  const startedThisYear = y % 2 === 1 && (m > 1 || d >= 3);
  const startYear = y % 2 === 1 ? (startedThisYear ? y : y - 2) : y - 1;
  return (startYear - 1789) / 2 + 1;
}

// "2025–2026" for the 119th.
export function congressYears(congress) {
  const start = 1789 + 2 * (congress - 1);
  return `${start}–${start + 1}`;
}

// The next general election: this year's if it hasn't happened yet (the Tuesday after the first
// Monday in November), otherwise two years on.
export function nextElectionYear(now = new Date()) {
  const y = now.getUTCFullYear();
  if (y % 2 === 1) return y + 1;
  const nov1 = new Date(Date.UTC(y, 10, 1));
  const firstMonday = 1 + ((8 - nov1.getUTCDay()) % 7);
  const electionDay = new Date(Date.UTC(y, 10, firstMonday + 1, 23));
  return now <= electionDay ? y : y + 2;
}

// When a seat is next up: every House seat at the next election; a Senate seat by its class
// (class 1 was elected in 2024, class 2 in 2026, class 3 in 2022, each for six years).
export function seatNextUp(chamber, senateClass, now = new Date()) {
  const next = nextElectionYear(now);
  if (chamber !== "senate") return next;
  const base = { 1: 2024, 2: 2026, 3: 2022 }[senateClass];
  if (!base) return null;
  let y = base;
  while (y < next) y += 6;
  return y;
}
