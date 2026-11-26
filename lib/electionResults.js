// Official general-election results (public/data/results/federal-{year}.json, built by
// scripts/data/election_results.py) matched to members of Congress by FEC candidate ID.
// Names, parties and figures are as printed in the source; nothing here ranks or judges them.

const raceKey = (r) => [r.state, r.office, r.district ?? "", r.date, r.term ?? ""].join("|");

// Every race in the loaded files where one of the member's FEC candidate IDs is a candidate, newest
// first, each as { race, candidate, source, percent }. The same race can be in two files (a special
// election listed in two years' publications): it is shown once, from the file listed first.
export function memberRaces(fecIds, docs) {
  const ids = new Set(fecIds ?? []);
  if (!ids.size) return [];
  const seen = new Set();
  const out = [];
  for (const doc of docs ?? []) {
    for (const race of doc.races ?? []) {
      const candidate = race.candidates.find((c) => (c.fec_ids ?? []).some((i) => ids.has(i)));
      if (!candidate || seen.has(raceKey(race))) continue;
      seen.add(raceKey(race));
      out.push({ race, candidate, source: doc.source, percent: doc.percent });
    }
  }
  return out.sort((a, z) => z.race.date.localeCompare(a.race.date) || Number(a.race.special) - Number(z.race.special));
}

// The member's share in a given day's general election, for a seat in one chamber ("S" or "H"):
// { pct, votes, unopposed, special } or null when they weren't a candidate in that file. With two
// races that day (a full term and an unexpired term), the full-term race.
export function shareOn(fecIds, doc, date, office) {
  if (!doc) return null;
  const hits = memberRaces(fecIds, [doc]).filter((x) => x.race.date === date && x.race.office === office);
  if (!hits.length) return null;
  const { race, candidate } = hits.find((x) => !x.race.special) ?? hits[0];
  return { pct: candidate.pct, votes: candidate.votes, unopposed: !!candidate.unopposed, special: !!race.special };
}

// "52.3%" (one decimal; the files keep two).
export const pctText = (p) => (p == null ? "" : `${(Math.round(p * 10) / 10).toFixed(1)}%`);
