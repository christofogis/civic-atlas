// Ingest campaign-finance detail per member per cycle, from OpenFEC (aggregates only; no
// individual donor names are stored):
//   - individual contributions by size            /schedules/schedule_a/by_size/by_candidate/
//   - top employers of individual donors          /schedules/schedule_a/by_employer/
//   - largest contributions from committees (PACs) /schedules/schedule_a/?is_individual=false
//   - outside spending for or against             /schedules/schedule_e/by_candidate/
// Needs DATA_GOV_API_KEY. Paced under OpenFEC's ~1,000 calls/hour; runs weekly.
//
//   node scripts/ingest/fec-detail.mjs                    # serving members, latest cycle with money
//   node scripts/ingest/fec-detail.mjs --probe C001055    # print raw fields for one member, write nothing
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";

const API = "https://api.open.fec.gov/v1";
const PAUSE_MS = 3800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (v) => (v == null || v === "" ? null : Number(v));
// Entries donors write in the employer field that don't name an employer. Listed on /methods.
const NOT_AN_EMPLOYER = /^(|N\/?A|NULL|NONE|RETIRED|SELF|SELF[- ]?EMPLOYED|NOT EMPLOYED|UNEMPLOYED|HOMEMAKER|STUDENT|INFORMATION REQUESTED.*|REQUESTED|ENTREPRENEUR)$/i;

// Shared pacer: request *starts* are spaced PAUSE_MS apart across all workers, so slow FEC
// responses overlap without exceeding the hourly limit.
let nextStart = 0;
async function pace() {
  const now = Date.now();
  const at = Math.max(now, nextStart);
  nextStart = at + PAUSE_MS;
  if (at > now) await sleep(at - now);
}

async function getJson(path, params, key) {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    await pace();
    const res = await fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" } });
    if (res.status === 429) { await sleep(120_000); continue; }
    if (res.status === 404) return null;
    if (res.ok) return res.json();
    if (res.status >= 500) { await sleep(10_000); continue; }
    throw new Error(`GET ${path}: HTTP ${res.status}`);
  }
  throw new Error(`GET ${path}: failed after retries`);
}

// One candidate ID and cycle -> rows for each table.
async function detail(candId, cycle, bioguide, key, probe) {
  const show = (label, data) => probe && console.log(`\n# ${label}\n`, JSON.stringify((data?.results ?? []).slice(0, 2), null, 1));

  const comms = await getJson(`/candidate/${candId}/committees/`, { cycle, designation: "P", per_page: 5 }, key);
  show("principal committees", comms);
  const committee = comms?.results?.[0]?.committee_id ?? null;

  const size = await getJson("/schedules/schedule_a/by_size/by_candidate/", { candidate_id: candId, cycle, per_page: 20 }, key);
  show("by size", size);
  const bySize = (size?.results ?? []).map((r) => ({
    fec_candidate_id: candId, cycle, bioguide_id: bioguide,
    size_bucket: Number(r.size), total: money(r.total), contributions: r.count ?? null,
  }));

  let employers = [], committeesIn = [];
  if (committee) {
    const emp = await getJson("/schedules/schedule_a/by_employer/", { committee_id: committee, cycle, sort: "-total", per_page: 40 }, key);
    show("by employer", emp);
    employers = (emp?.results ?? []).filter((r) => !NOT_AN_EMPLOYER.test(String(r.employer ?? "").trim())).slice(0, 15).map((r, i) => ({
      fec_candidate_id: candId, cycle, bioguide_id: bioguide, rank: i + 1,
      employer: String(r.employer ?? "").trim() || "(blank)", total: money(r.total), contributions: r.count ?? null,
    }));

    // Form 3 line 11C: contributions from other political committees (PACs). This leaves out
    // transfers from the member's own fundraising committees (line 12), loans and party money.
    const pac = await getJson("/schedules/schedule_a/", {
      committee_id: committee, two_year_transaction_period: cycle, line_number: "F3-11C",
      sort: "-contribution_receipt_amount", per_page: 100,
    }, key);
    show("committee contributions", pac);
    const sums = new Map();
    if (probe) console.log("line numbers seen:", [...new Set((pac?.results ?? []).map((r) => r.line_number))].join(","));
    for (const r of pac?.results ?? []) {
      const id = r.contributor_committee_id ?? r.contributor_id ?? r.contributor_name;
      if (!id) continue;
      const cur = sums.get(id) ?? { name: r.contributor_name, amount: 0, n: 0 };
      cur.amount += Number(r.contribution_receipt_amount ?? 0); cur.n++;
      sums.set(id, cur);
    }
    committeesIn = [...sums].sort((a, b) => b[1].amount - a[1].amount).slice(0, 15).map(([id, v], i) => ({
      fec_candidate_id: candId, cycle, bioguide_id: bioguide, rank: i + 1,
      contributor_committee_id: String(id), contributor_name: v.name, total: v.amount, contributions: v.n,
    }));
  }

  const ie = await getJson("/schedules/schedule_e/by_candidate/", { candidate_id: candId, cycle, per_page: 100, sort: "-total" }, key);
  show("outside spending", ie);
  const outside = (ie?.results ?? [])
    .filter((r) => r.committee_id && ["S", "O"].includes(r.support_oppose_indicator))
    .map((r) => ({
      fec_candidate_id: candId, cycle, bioguide_id: bioguide,
      committee_id: r.committee_id, committee_name: r.committee_name ?? r.committee_id,
      support_oppose: r.support_oppose_indicator === "S" ? "support" : "oppose", total: money(r.total),
    }));

  return { committee, bySize, employers, committeesIn, outside };
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) throw new Error("DATA_GOV_API_KEY must be set");
  const db = getClient();

  // Each serving member's FEC candidate IDs, in the most recent cycle with reported receipts.
  const serving = new Set((await fetchAll(db, "seat_holders", "bioguide_id")).map((r) => r.bioguide_id));
  const totals = await fetchAll(db, "finance_summaries", "fec_candidate_id,cycle,bioguide_id,receipts");
  const latest = new Map();
  for (const t of totals) {
    if (!serving.has(t.bioguide_id) || !(t.receipts > 0)) continue;
    const cur = latest.get(t.fec_candidate_id);
    if (!cur || t.cycle > cur.cycle) latest.set(t.fec_candidate_id, t);
  }
  let work = [...latest.values()];

  const probe = arg("--probe");
  if (probe) {
    work = work.filter((w) => w.bioguide_id === probe).slice(0, 1);
    if (!work.length) throw new Error(`no FEC totals on file for ${probe}`);
    const d = await detail(work[0].fec_candidate_id, work[0].cycle, probe, key, true);
    console.log("\nmapped:", JSON.stringify({ committee: d.committee, bySize: d.bySize.length, employers: d.employers.slice(0, 3),
      committeesIn: d.committeesIn.slice(0, 3), outside: d.outside.slice(0, 3) }, null, 1));
    return;
  }

  // Members with no detail yet go first; the rest in random order, so a run that hits the
  // time limit doesn't always leave the same members out.
  const have = new Set((await fetchAll(db, "finance_top_employers", "fec_candidate_id")).map((r) => r.fec_candidate_id));
  const shuffled = work.map((w) => [Math.random(), w]).sort((a, b) => a[0] - b[0]).map(([, w]) => w);
  work = [...shuffled.filter((w) => !have.has(w.fec_candidate_id)), ...shuffled.filter((w) => have.has(w.fec_candidate_id))];

  await withRun(db, "fec-detail", async () => {
    console.log(`candidate IDs: ${work.length} (${work.filter((w) => !have.has(w.fec_candidate_id)).length} without detail yet)`);
    let n = 0, rows = 0, i = 0;
    const one = async (w) => {
      const d = await detail(w.fec_candidate_id, w.cycle, w.bioguide_id, key, false);
      // Replace this candidate-cycle's rows: rankings change from week to week.
      for (const t of ["finance_by_size", "finance_top_employers", "finance_committee_contributions", "outside_spending"]) {
        const { error } = await db.from(t).delete().eq("fec_candidate_id", w.fec_candidate_id).eq("cycle", w.cycle);
        if (error) throw new Error(`clear ${t}: ${error.message}`);
      }
      await upsertBatches(db, "finance_by_size", d.bySize, "fec_candidate_id,cycle,size_bucket");
      await upsertBatches(db, "finance_top_employers", d.employers, "fec_candidate_id,cycle,rank");
      await upsertBatches(db, "finance_committee_contributions", d.committeesIn, "fec_candidate_id,cycle,rank");
      await upsertBatches(db, "outside_spending", d.outside, "fec_candidate_id,cycle,committee_id,support_oppose");
      rows += d.bySize.length + d.employers.length + d.committeesIn.length + d.outside.length;
      if (++n % 50 === 0) console.log(`  ${n}/${work.length}`);
    };
    await Promise.all(Array.from({ length: 3 }, async () => { while (i < work.length) await one(work[i++]); }));
    console.log(`done: ${n} candidates, ${rows} rows`);
    return { rows_inserted: rows, rows_updated: 0 };
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
