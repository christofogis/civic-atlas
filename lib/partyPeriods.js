// Party over a term. congress-legislators lists party_affiliations on a term only when the member
// changed party during it; the database stores them in term_party_periods and the member page gets
// them as term.party_periods. A term without periods had its listed party throughout.

// The stretches of a term, in order: [{ party, caucus, start_date, end_date }].
export function termPartyPeriods(term) {
  const list = (term?.party_periods ?? []).filter((p) => p?.party && p.start_date && p.end_date);
  if (!list.length) return [{ party: term.party, caucus: term.caucus ?? null, start_date: term.start_date, end_date: term.end_date }];
  return [...list].sort((a, z) => (a.start_date < z.start_date ? -1 : a.start_date > z.start_date ? 1 : 0));
}

// The party listed on a day (YYYY-MM-DD) within a term. Where two stretches share a day (the
// source ends one and starts the next on the same date), the later one is used, as the database does.
export function termPartyOn(term, day) {
  const hit = termPartyPeriods(term).filter((p) => day >= p.start_date && day <= p.end_date);
  return hit.length ? hit.at(-1).party : null;
}
