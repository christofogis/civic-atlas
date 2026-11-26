// Which seats are on the ballot in a given general-election year, from term end dates. A seat is on
// year Y's ballot when its holder's term ends after the previous general election and no later than
// January 3 after Y's election (when new congressional terms begin). This catches every regular
// seat and also an appointed senator whose term runs only until a special election that year.

// Federal general election: the Tuesday after the first Monday in November.
export function generalElectionDate(year) {
  const nov1 = new Date(Date.UTC(year, 10, 1));
  const firstMonday = 1 + ((8 - nov1.getUTCDay()) % 7);
  return new Date(Date.UTC(year, 10, firstMonday + 1)).toISOString().slice(0, 10);
}

// Even years only; the next one on or after a date.
export function nextElectionYear(today) {
  const y = Number(today.slice(0, 4));
  const even = y % 2 === 0 ? y : y + 1;
  return today <= generalElectionDate(even) ? even : even + 2;
}

export function onBallot(term, year) {
  const after = generalElectionDate(year - 2);
  const by = `${year + 1}-01-03`;
  return term.end_date > after && term.end_date <= by;
}

// Senate seats come in three classes; class 2 was elected in 2020/2026, class 3 in 2022/2028,
// class 1 in 2024/2030.
export function senateClassFor(year) {
  return [2, 3, 1][((year - 2026) / 2 % 3 + 3) % 3];
}

// California statewide executive offices and the Board of Equalization are elected in the
// gubernatorial years (2026, 2030, ...), the Assembly every two years, and the state Senate's
// odd-numbered districts in presidential years, even-numbered in gubernatorial years.
export const isGubernatorialYear = (year) => year % 4 === 2;

// "November 2028" -> 2028
export const yearOfLabel = (label) => Number(String(label ?? "").match(/\b(20\d\d)\b/)?.[1]) || null;

// Local terms (county and city) begin in early January after a November election.
export const localOnBallot = (termEnd, year) => termEnd >= `${year + 1}-01-01` && termEnd <= `${year + 1}-01-15`;

// The general-election year whose ballot a term's seat is on.
export function ballotYearFor(term) {
  const y = Number(term.end_date.slice(0, 4));
  for (const year of [y - 1, y, y - 2]) if (year % 2 === 0 && onBallot(term, year)) return year;
  return null;
}
