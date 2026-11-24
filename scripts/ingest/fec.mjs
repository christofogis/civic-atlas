// Ingest campaign finance totals per candidate per two-year cycle, from OpenFEC.
// Needs DATA_GOV_API_KEY (sent as a header). Totals only: no contributor names.
//
//   node scripts/ingest/fec.mjs                      # serving members
//   node scripts/ingest/fec.mjs --dry-run --limit 2  # a couple of candidates, prints raw fields
//
// OpenFEC allows about 1,000 calls an hour per key, so calls are paced; a full run of
// ~800 candidate IDs takes about an hour. FEC data changes with filing deadlines, so
// this runs weekly.
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";

const API = "https://api.open.fec.gov/v1";
const FROM_CYCLE = 2022;
const PAUSE_MS = 3800; // ~950 calls/hour
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (v) => (v == null || v === "" ? null : Number(v));

export function mapTotals(r, bioguide) {
  return {
    fec_candidate_id: r.candidate_id,
    cycle: r.cycle,
    bioguide_id: bioguide,
    receipts: money(r.receipts),
    disbursements: money(r.disbursements),
    cash_on_hand: money(r.last_cash_on_hand_end_period ?? r.cash_on_hand_end_period),
    debts_owed: money(r.last_debts_owed_by_committee ?? r.debts_owed_by_committee),
    individual_contributions: money(r.individual_contributions),
    pac_contributions: money(r.other_political_committee_contributions),
    party_contributions: money(r.political_party_committee_contributions),
    candidate_self_funding: money(r.candidate_contribution),
    coverage_end_date: r.coverage_end_date ? String(r.coverage_end_date).slice(0, 10) : null,
    source_url: `https://www.fec.gov/data/candidate/${r.candidate_id}/?cycle=${r.cycle}`,
    fetched_at: new Date().toISOString(),
  };
}

async function getJson(url, key) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(PAUSE_MS);
    const res = await fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" } });
    if (res.status === 429) { await sleep(120_000); continue; }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
    return res.json();
  }
  throw new Error(`GET ${url}: still rate limited`);
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const dryRun = args.includes("--dry-run");
  const limit = arg("--limit") ? parseInt(arg("--limit"), 10) : Infinity;
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) throw new Error("DATA_GOV_API_KEY must be set");

  const db = getClient();
  const run = async () => {
    const serving = new Set((await fetchAll(db, "seat_holders", "bioguide_id")).map((r) => r.bioguide_id));
    const pairs = (await fetchAll(db, "members", "bioguide_id,fec_candidate_ids"))
      .filter((m) => serving.has(m.bioguide_id))
      .flatMap((m) => m.fec_candidate_ids.map((id) => [id, m.bioguide_id]))
      .slice(0, limit);
    console.log(`candidate IDs to refresh: ${pairs.length}`);

    const rows = [];
    let n = 0;
    for (const [id, bioguide] of pairs) {
      // election_full=false: one row per two-year cycle rather than per full Senate term.
      const data = await getJson(`${API}/candidate/${id}/totals/?per_page=100&election_full=false&sort=-cycle`, key);
      const results = (data?.results ?? []).filter((r) => r.cycle >= FROM_CYCLE);
      if (dryRun && n === 0 && results[0]) console.log("raw fields:", Object.keys(results[0]).join(", "));
      rows.push(...results.map((r) => mapTotals(r, bioguide)));
      if (++n % 100 === 0) console.log(`  ${n}/${pairs.length}`);
    }
    console.log(`totals rows: ${rows.length}`);
    if (dryRun) {
      console.log("sample:", JSON.stringify(rows[0] ?? null));
      console.log("dry run: nothing written");
      return { rows_inserted: 0, rows_updated: 0 };
    }
    await upsertBatches(db, "finance_summaries", rows, "fec_candidate_id,cycle");
    return { rows_inserted: 0, rows_updated: rows.length };
  };

  if (dryRun) await run();
  else await withRun(db, "fec-summaries", run);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
