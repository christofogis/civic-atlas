// Run the committee-contribution totals (scripts/ingest/fec-pas2.mjs) on the real FEC bulk files
// for every serving member's latest cycle, read through the public (read-only) API, and print
// Coons's 2026 list plus coverage. Prints only; writes nothing.
import { committeeGifts, rankGivers } from "../ingest/fec-pas2.mjs";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../src/lib/config.js";

const get = async (path) => {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Range: `${from}-${from + 999}` } });
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
};
const serving = new Set((await get("seat_holders?select=bioguide_id")).map((r) => r.bioguide_id));
const latest = new Map();
for (const t of await get("finance_summaries?select=fec_candidate_id,cycle,bioguide_id,receipts")) {
  if (!serving.has(t.bioguide_id) || !(t.receipts > 0)) continue;
  const cur = latest.get(t.fec_candidate_id);
  if (!cur || t.cycle > cur.cycle) latest.set(t.fec_candidate_id, t);
}
const work = [...latest.values()];
console.log(`serving members' candidate IDs: ${work.length}; cycles: ${[...new Set(work.map((w) => w.cycle))].join(",")}`);
const t0 = Date.now();
for (const cycle of [...new Set(work.map((w) => w.cycle))].sort()) {
  const ids = work.filter((w) => w.cycle === cycle).map((w) => w.fec_candidate_id);
  const g = await committeeGifts(cycle, ids);
  const none = ids.filter((id) => !g.totals.has(id));
  console.log(`cycle ${cycle}: ${ids.length - none.length} of ${ids.length} have committee contributions; without: ${none.slice(0, 15).join(",")}${none.length > 15 ? "…" : ""}`);
  const lens = ids.map((id) => rankGivers(g.totals.get(id), g.names).length);
  console.log(`  rows to store per candidate: max ${Math.max(...lens)}, total ${lens.reduce((a, b) => a + b, 0)}`);
  if (ids.includes("S0DE00092")) {
    const all = rankGivers(g.totals.get("S0DE00092"), g.names, { top: 1000, cap: 1000 });
    const stored = rankGivers(g.totals.get("S0DE00092"), g.names);
    console.log(`\nCoons ${cycle} (FEC file dated ${g.asOf}): ${all.length} giving committees, $${all.reduce((a, r) => a + r.cents, 0) / 100} in all; ${stored.length} rows stored`);
    stored.slice(0, 12).forEach((r, i) => console.log(`  ${i + 1}. ${r.name} (${r.id}) $${r.cents / 100} in ${r.contributions}`));
    for (const id of ["C00761957", "C00797670"]) {
      const i = all.findIndex((r) => r.id === id);
      console.log(`  check ${id}: ${i < 0 ? "not found" : `${all[i].name} $${all[i].cents / 100} in ${all[i].contributions}, position ${i + 1}, ${stored.some((r) => r.id === id) ? "stored" : "not stored"}`}`);
    }
  }
}
console.log(`elapsed ${Math.round((Date.now() - t0) / 1000)}s`);
