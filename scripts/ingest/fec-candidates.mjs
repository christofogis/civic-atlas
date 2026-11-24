// Candidates who have filed with the FEC for the next congressional election, with totals.
// Source: OpenFEC /candidates/totals/ (needs DATA_GOV_API_KEY). Names are as filed; no
// contributor data. Run weekly with the other FEC jobs.
//   node scripts/ingest/fec-candidates.mjs [--dry-run] [--year 2028]
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";

const API = "https://api.open.fec.gov/v1";
const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STATUS = { I: "Incumbent", C: "Challenger", O: "Open seat" };

// The next general election: this year's if it hasn't happened yet (first Tuesday after the
// first Monday in November), otherwise two years on.
export function nextElectionYear(now = new Date()) {
  const y = now.getUTCFullYear();
  if (y % 2 === 1) return y + 1;
  const nov1 = new Date(Date.UTC(y, 10, 1));
  const firstMonday = 1 + ((8 - nov1.getUTCDay()) % 7);
  const electionDay = new Date(Date.UTC(y, 10, firstMonday + 1, 23));
  return now <= electionDay ? y : y + 2;
}

async function getJson(url, key) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(1200);
    const res = await fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" } });
    if (res.status === 429) { await sleep(120_000); continue; }
    if (!res.ok) throw new Error(`OpenFEC HTTP ${res.status} for ${new URL(url).pathname}`);
    return res.json();
  }
  throw new Error("OpenFEC: still rate limited");
}

async function run(db) {
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) throw new Error("DATA_GOV_API_KEY must be set");
  const year = Number(args[args.indexOf("--year") + 1]) || nextElectionYear();
  const byFec = new Map();
  if (db) {
    for (const m of await fetchAll(db, "members", "bioguide_id,fec_candidate_ids")) {
      for (const id of m.fec_candidate_ids ?? []) byFec.set(id, m.bioguide_id);
    }
  }
  const rows = [];
  // Every filer comes from /candidates/; money from /candidates/totals/ for the two-year period
  // ending in the election year (election_full=false), so senators (six-year terms) and House
  // candidates are counted over the same span. Before anyone has reported for that period,
  // there are no totals and receipts stay empty.
  async function pagesOf(path, params) {
    const out = [];
    let page = 1, pages = 1;
    do {
      const q = new URLSearchParams({ ...params, per_page: "100", page: String(page) });
      const data = await getJson(`${API}${path}?${q}`, key);
      pages = data.pagination?.pages ?? 1;
      out.push(...(data.results ?? []));
      page++;
    } while (page <= pages);
    return out;
  }
  for (const office of ["H", "S"]) {
    const filers = await pagesOf("/candidates/", { election_year: String(year), office, is_active_candidate: "true", sort: "name" });
    const totals = new Map((await pagesOf("/candidates/totals/", { election_year: String(year), cycle: String(year), election_full: "false", office }))
      .map((t) => [t.candidate_id, t]));
    if (DRY) console.log("sample:", JSON.stringify(filers[0]), JSON.stringify([...totals.values()][0] ?? null));
    for (const c of filers) {
      if (!c.candidate_id || !c.state) continue;
      const t = totals.get(c.candidate_id);
      rows.push({
        fec_candidate_id: c.candidate_id, election_year: year, name: c.name, party: c.party_full ?? null,
        office, state: c.state, district: office === "H" ? Number(c.district_number ?? c.district ?? 0) : null,
        incumbent_challenge: STATUS[c.incumbent_challenge] ?? c.incumbent_challenge_full ?? null,
        receipts: t?.receipts ?? null, disbursements: t?.disbursements ?? null,
        cash_on_hand: t?.cash_on_hand_end_period ?? null, coverage_end_date: t?.coverage_end_date?.slice(0, 10) ?? null,
        bioguide_id: byFec.get(c.candidate_id) ?? null,
      });
    }
    console.log(`${year} ${office === "H" ? "House" : "Senate"}: ${filers.length} candidates, ${totals.size} with ${year - 1}–${year} totals`);
  }
  // Guard: an empty or failed listing must not wipe the table.
  if (rows.length === 0) throw new Error("OpenFEC returned no candidates; nothing changed");
  if (DRY) { console.log(`dry run: ${rows.length} candidates, nothing written`); return { rows_inserted: 0, rows_updated: 0 }; }
  await upsertBatches(db, "candidates", rows, "fec_candidate_id,election_year");
  // Candidates no longer listed as active for this election are removed.
  const ids = new Set(rows.map((r) => r.fec_candidate_id));
  const stored = await fetchAll(db, "candidates", "fec_candidate_id,election_year");
  const gone = stored.filter((s) => s.election_year === year && !ids.has(s.fec_candidate_id)).map((s) => s.fec_candidate_id);
  for (let i = 0; i < gone.length; i += 200) {
    await db.from("candidates").delete().eq("election_year", year).in("fec_candidate_id", gone.slice(i, i + 200));
  }
  console.log(`saved ${rows.length}; removed ${gone.length} no longer active; ${rows.filter((r) => r.bioguide_id).length} matched to members`);
  return { rows_inserted: 0, rows_updated: rows.length, rows_deleted: gone.length };
}

if (DRY) await run(null);
else { const db = getClient(); await withRun(db, "fec-candidates", () => run(db)); }
