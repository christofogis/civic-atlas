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
