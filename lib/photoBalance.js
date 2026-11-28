// Photos are shown for a state legislative chamber only when its two largest parties have similar
// coverage (Chris, Nov 28, 2026): if Democrats' and Republicans' photo shares differ by more than
// 20 percentage points, with at least 5 members of each party to compare, no one in that chamber
// gets a photo, so neither party looks more complete. Rechecked on every data refresh.
export const MAX_GAP_POINTS = 20;
export const MIN_PER_PARTY = 5;

const partyKey = (p) => (/^democrat/i.test(p ?? "") ? "D" : /^republican/i.test(p ?? "") ? "R" : null);

// people: [{id, party, image_url}], roles: [{person_id, state, type, end_date}] (current role has no
// end date or one after today). Returns {hide: Set of person ids, chambers: [{state, type, d, r}]}.
export function unevenChambers(people, roles, today = new Date().toISOString().slice(0, 10)) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const groups = new Map();
  for (const r of roles) {
    if (r.type !== "upper" && r.type !== "lower") continue;
    if (r.end_date && r.end_date <= today) continue;
    const p = byId.get(r.person_id);
    if (!p) continue;
    const k = `${r.state}|${r.type}`;
    if (!groups.has(k)) groups.set(k, new Set());
    groups.get(k).add(p.id);
  }
  const hide = new Set(), chambers = [];
  for (const [k, ids] of groups) {
    const tally = { D: [0, 0], R: [0, 0] };
    for (const id of ids) {
      const p = byId.get(id), pk = partyKey(p.party);
      if (!pk) continue;
      tally[pk][0] += 1;
      if (p.image_url) tally[pk][1] += 1;
    }
    const [dn, dw] = tally.D, [rn, rw] = tally.R;
    if (dn < MIN_PER_PARTY || rn < MIN_PER_PARTY) continue;
    const d = Math.round((100 * dw) / dn), r = Math.round((100 * rw) / rn);
    if (Math.abs(d - r) > MAX_GAP_POINTS) {
      const [state, type] = k.split("|");
      chambers.push({ state, type, d, r });
      for (const id of ids) hide.add(id);
    }
  }
  return { hide, chambers };
}
