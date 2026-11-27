// Ingest campaign-finance detail per member per cycle, from OpenFEC (aggregates only; no
// individual donor names are stored):
//   - individual contributions by size            /schedules/schedule_a/by_size/by_candidate/
//   - top employers of individual donors          /schedules/schedule_a/by_employer/
//   - committees (PACs etc.) that gave the most    FEC bulk file pas2{yy}.zip (see fec-pas2.mjs)
//   - outside spending for or against             /schedules/schedule_e/by_candidate/
//   - itemized individual contributions by state  /schedules/schedule_a/by_state/by_candidate/
// Needs DATA_GOV_API_KEY. Paced under OpenFEC's ~1,000 calls/hour; runs weekly. The bulk files
// need no key and `unzip` on the PATH.
//
//   node scripts/ingest/fec-detail.mjs                    # serving members, latest cycle with money
//   node scripts/ingest/fec-detail.mjs --probe C001055    # print raw fields for one member, write nothing
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { committeeGifts, rankGivers } from "./fec-pas2.mjs";

const API = "https://api.open.fec.gov/v1";
const PAUSE_MS = 3800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (v) => (v == null || v === "" ? null : Number(v));
// Entries donors write in the employer field that don't name an employer. Listed on /methods.
// Compared with punctuation and spaces removed, so "SELF - EMPLOYED" and "RETIRED." match; common
// misspellings of self-employed ("SELF EMPLYED", "SELF-EMPOLOYED") are caught by the SELFE...D pattern.
const NOT_AN_EMPLOYER_WORDS = /^(|NA|NULL|NONE|RETIRED|NARETIRED|SELF|SELFE[A-Z]{3,7}D|NOTEMPLOYED|UNEMPLOYED|HOMEMAKER|STUDENT|INFORMATIONREQUESTED.*|REQUESTED|ENTREPRENEUR)$/;
const NOT_AN_EMPLOYER = { test: (s) => NOT_AN_EMPLOYER_WORDS.test(String(s).toUpperCase().replace(/[^A-Z]/g, "")) };

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

// One candidate ID and cycle -> rows for each table. election_full=false asks for the two-year
// period itself; the default covers a senator's whole six-year term and is empty off-years.
async function detail(candId, cycle, bioguide, key, probe) {
  const show = (label, data) => probe && console.log(`\n# ${label}\n`, JSON.stringify((data?.results ?? []).slice(0, 2), null, 1));

  const comms = await getJson(`/candidate/${candId}/committees/`, { cycle, designation: "P", per_page: 5 }, key);
  show("principal committees", comms);
  const committee = comms?.results?.[0]?.committee_id ?? null;

  const size = await getJson("/schedules/schedule_a/by_size/by_candidate/", { candidate_id: candId, cycle, election_full: false, per_page: 20 }, key);
  show("by size", size);
  const bySize = (size?.results ?? []).map((r) => ({
    fec_candidate_id: candId, cycle, bioguide_id: bioguide,
    size_bucket: Number(r.size), total: money(r.total), contributions: r.count ?? null,
  }));

  let employers = [];
  if (committee) {
    const emp = await getJson("/schedules/schedule_a/by_employer/", { committee_id: committee, cycle, sort: "-total", per_page: 40 }, key);
    show("by employer", emp);
    employers = (emp?.results ?? []).filter((r) => !NOT_AN_EMPLOYER.test(String(r.employer ?? "").trim())).slice(0, 15).map((r, i) => ({
      fec_candidate_id: candId, cycle, bioguide_id: bioguide, rank: i + 1,
      employer: String(r.employer ?? "").trim() || "(blank)", total: money(r.total), contributions: r.count ?? null,
    }));
  }

  const ie = await getJson("/schedules/schedule_e/by_candidate/", { candidate_id: candId, cycle, election_full: false, per_page: 100, sort: "-total" }, key);
  show("outside spending", ie);
  const outside = (ie?.results ?? [])
    .filter((r) => r.committee_id && ["S", "O"].includes(r.support_oppose_indicator))
    .map((r) => ({
      fec_candidate_id: candId, cycle, bioguide_id: bioguide,
      committee_id: r.committee_id, committee_name: r.committee_name ?? r.committee_id,
      support_oppose: r.support_oppose_indicator === "S" ? "support" : "oppose", total: money(r.total),
    }));

  const st = await getJson("/schedules/schedule_a/by_state/by_candidate/", { candidate_id: candId, cycle, election_full: false, per_page: 100 }, key);
  show("by state", st);
  const byStateMap = new Map();
  for (const r of st?.results ?? []) {
    const s = String(r.state ?? "").trim().toUpperCase() || "(none)";
    const cur = byStateMap.get(s) ?? { total: 0, n: 0 };
    cur.total += Number(r.total ?? 0); cur.n += Number(r.count ?? 0);
    byStateMap.set(s, cur);
  }
  const byState = [...byStateMap].map(([state, v]) => ({ fec_candidate_id: candId, cycle, bioguide_id: bioguide, state, total: v.total, contributions: v.n }));

  return { committee, bySize, employers, outside, byState };
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
  if (probe) work = work.filter((w) => w.bioguide_id === probe).slice(0, 1);

  // Committee contributions come from the FEC bulk file for each cycle in the work list: true
  // totals per giving committee, read in one pass instead of one API call per member.
  const gifts = new Map();
  for (const cycle of [...new Set(work.map((w) => w.cycle))].sort()) {
    try {
      gifts.set(cycle, await committeeGifts(cycle, work.filter((w) => w.cycle === cycle).map((w) => w.fec_candidate_id)));
    } catch (err) {
      // Keep the rows already stored for this cycle rather than blanking them.
      console.log(`pas2 ${cycle}: ${err.message}; committee contributions for this cycle left as they were`);
    }
  }
  // null when the cycle's bulk file couldn't be read.
  const committeesIn = (w) => {
    const g = gifts.get(w.cycle);
    if (!g) return null;
    return rankGivers(g.totals.get(w.fec_candidate_id), g.names).map((v, i) => ({
      fec_candidate_id: w.fec_candidate_id, cycle: w.cycle, bioguide_id: w.bioguide_id, rank: i + 1,
      contributor_committee_id: v.id, contributor_name: v.name, total: v.cents / 100, contributions: v.contributions,
      source_date: g.asOf,
    }));
  };

  if (probe) {
    if (!work.length) throw new Error(`no FEC totals on file for ${probe}`);
    const d = await detail(work[0].fec_candidate_id, work[0].cycle, probe, key, true);
    console.log("\nmapped:", JSON.stringify({ committee: d.committee, bySize: d.bySize.length, employers: d.employers.slice(0, 3),
      committeesIn: committeesIn(work[0])?.slice(0, 12), outside: d.outside.slice(0, 3), byState: d.byState.sort((a, z) => z.total - a.total).slice(0, 5) }, null, 1));
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
    // Committee contributions for everyone first: they come from the bulk file already read, so
    // they don't wait on the paced API calls below. Replace each candidate-cycle's rows.
    for (const w of work) {
      const list = committeesIn(w);
      if (!list) continue;
      const { error } = await db.from("finance_committee_contributions").delete().eq("fec_candidate_id", w.fec_candidate_id).eq("cycle", w.cycle);
      if (error) throw new Error(`clear finance_committee_contributions: ${error.message}`);
      await upsertBatches(db, "finance_committee_contributions", list, "fec_candidate_id,cycle,rank");
      rows += list.length;
    }
    console.log(`committee contributions: ${rows} rows for ${work.length} candidate IDs`);
    const one = async (w) => {
      const d = await detail(w.fec_candidate_id, w.cycle, w.bioguide_id, key, false);
      // Replace this candidate-cycle's rows: rankings change from week to week.
      for (const t of ["finance_by_size", "finance_top_employers", "outside_spending", "finance_by_state"]) {
        const { error } = await db.from(t).delete().eq("fec_candidate_id", w.fec_candidate_id).eq("cycle", w.cycle);
        if (error) throw new Error(`clear ${t}: ${error.message}`);
      }
      await upsertBatches(db, "finance_by_size", d.bySize, "fec_candidate_id,cycle,size_bucket");
      await upsertBatches(db, "finance_top_employers", d.employers, "fec_candidate_id,cycle,rank");
      await upsertBatches(db, "outside_spending", d.outside, "fec_candidate_id,cycle,committee_id,support_oppose");
      await upsertBatches(db, "finance_by_state", d.byState, "fec_candidate_id,cycle,state");
      rows += d.bySize.length + d.employers.length + d.outside.length + d.byState.length;
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
