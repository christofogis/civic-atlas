// Lobbying reports (LD-2) from LDA.gov that name a bill we track.
//
//   node scripts/ingest/lobbying.mjs                      # daily: filings posted since the last run
//   node scripts/ingest/lobbying.mjs --quarters 2025-1,2025-2   # backfill whole quarters
//   node scripts/ingest/lobbying.mjs --quarters 2025-3 --dry-run --pages 4
//
// LDA.gov returns 25 filings per page. Without an API key it allows 15 requests a minute
// (~75 minutes per quarter of ~27,000 filings); with LDA_API_KEY, 120 a minute.
// Each report's free-text "specific lobbying issues" is scanned for bill numbers; the Congress
// comes from the filing year, and only bills already in `bills` are kept.
// Amendments: per registrant, client, year and quarter, only the latest-posted report is kept.
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { extractBillRefs, congressForYear } from "../../lib/billrefs.js";

const BASE = "https://lda.gov/api/v1/filings/";
const KEY = process.env.LDA_API_KEY;
const GAP_MS = KEY ? 550 : 4100;
const PERIODS = ["first_quarter", "second_quarter", "third_quarter", "fourth_quarter"];
const args = process.argv.slice(2);
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes("--dry-run");
const MAX_PAGES = Number(arg("--pages") ?? Infinity);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let last = 0;
async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    const wait = last + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { Accept: "application/json", ...(KEY ? { Authorization: `Token ${KEY}` } : {}) } });
    } catch (err) {
      if (attempt >= 5) throw new Error(`LDA fetch failed: ${err.message}`);
      await sleep(10_000 * attempt);
      continue;
    }
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const retry = Number(res.headers.get("retry-after")) || 30 * attempt;
      console.log(`  LDA ${res.status}; waiting ${retry}s`);
      await sleep(retry * 1000);
      continue;
    }
    throw new Error(`LDA ${res.status} for ${new URL(url).search}`);
  }
}

async function* pages(params) {
  let url = `${BASE}?${new URLSearchParams({ ...params, ordering: "dt_posted", page_size: "25" })}`;
  for (let n = 0; url && n < MAX_PAGES; n++) {
    const data = await getJson(url);
    if (n === 0) console.log(`  ${data.count} filings for ${JSON.stringify(params)}`);
    yield data.results ?? [];
    url = data.next;
  }
}

// One LD-2 -> filing row + bill mentions (possibly none). Registrations (RR, RA) are skipped.
function parse(f, tracked) {
  if (!f.filing_period || /^R/.test(f.filing_type) || !PERIODS.includes(f.filing_period)) { stats.skipped++; return null; }
  const congress = congressForYear(f.filing_year);
  const byBill = new Map();
  for (const a of f.lobbying_activities ?? []) {
    for (const ref of extractBillRefs(a.description)) {
      const k = `${congress}|${ref.bill_type}|${ref.number}`;
      stats.refs++;
      if (!tracked.has(k)) { stats.untracked++; continue; }
      const m = byBill.get(k) ?? { filing_uuid: f.filing_uuid, congress, ...ref, issue_codes: [] };
      if (a.general_issue_code && !m.issue_codes.includes(a.general_issue_code)) m.issue_codes.push(a.general_issue_code);
      byBill.set(k, m);
    }
  }
  return {
    filing: {
      filing_uuid: f.filing_uuid, filing_type: f.filing_type, filing_year: f.filing_year,
      filing_period: f.filing_period, registrant_id: f.registrant?.id, registrant_name: f.registrant?.name ?? "",
      client_id: f.client?.id, client_name: f.client?.name ?? "", dt_posted: f.dt_posted,
    },
    mentions: [...byBill.values()],
  };
}

const stats = { refs: 0, untracked: 0, skipped: 0 };
const keyOf = (r) => `${r.registrant_id}|${r.client_id}|${r.filing_year}|${r.filing_period}`;

// Apply one page of parsed filings: newest version per key wins, against the database too.
async function apply(db, parsed, counts) {
  const latest = new Map();
  for (const p of parsed) {
    const k = keyOf(p.filing);
    const prev = latest.get(k);
    if (!prev || new Date(p.filing.dt_posted) > new Date(prev.filing.dt_posted)) latest.set(k, p);
  }
  if (!latest.size) return;
  const ids = (f) => [...new Set([...latest.values()].map((p) => p.filing[f]))];
  const { data: existing, error } = await db.from("lobbying_filings")
    .select("filing_uuid, registrant_id, client_id, filing_year, filing_period, dt_posted")
    .in("registrant_id", ids("registrant_id")).in("client_id", ids("client_id")).range(0, 9999);
  if (error) throw new Error(`read lobbying_filings: ${error.message}`);

  const remove = [];
  const insert = [];
  for (const [k, p] of latest) {
    const same = existing.filter((e) => keyOf(e) === k && e.filing_uuid !== p.filing.filing_uuid);
    if (same.some((e) => new Date(e.dt_posted) > new Date(p.filing.dt_posted))) continue; // a newer version is on file
    remove.push(...same.map((e) => e.filing_uuid));
    if (p.mentions.length) insert.push(p);
    else if (existing.some((e) => e.filing_uuid === p.filing.filing_uuid)) remove.push(p.filing.filing_uuid);
  }
  if (DRY) {
    counts.rows_inserted += insert.length;
    counts.rows_deleted += remove.length;
    for (const p of insert.slice(0, 3)) {
      console.log(`  ${p.filing.client_name} via ${p.filing.registrant_name}:`,
        p.mentions.map((m) => `${m.bill_type}${m.number}`).join(" "));
    }
    return;
  }
  if (remove.length) {
    const { error: delErr } = await db.from("lobbying_filings").delete().in("filing_uuid", remove);
    if (delErr) throw new Error(`delete superseded: ${delErr.message}`);
    counts.rows_deleted += remove.length;
  }
  if (insert.length) {
    const uuids = insert.map((p) => p.filing.filing_uuid);
    const { error: e2 } = await db.from("lobbying_bill_mentions").delete().in("filing_uuid", uuids);
    if (e2) throw new Error(`clear mentions: ${e2.message}`);
    await upsertBatches(db, "lobbying_filings", insert.map((p) => p.filing), "filing_uuid");
    await upsertBatches(db, "lobbying_bill_mentions", insert.flatMap((p) => p.mentions),
      "filing_uuid,congress,bill_type,number");
    counts.rows_inserted += insert.length;
  }
}

async function run(db, counts) {
  const bills = await fetchAll(db, "bills", "congress, bill_type, number");
  const tracked = new Set(bills.map((b) => `${b.congress}|${b.bill_type}|${b.number}`));
  console.log(`${tracked.size} tracked bills; ${KEY ? "API key" : "no API key (15 requests/minute)"}`);

  const quarters = arg("--quarters");
  const queries = [];
  if (quarters) {
    for (const q of quarters.split(",")) {
      const [y, n] = q.trim().split("-").map(Number);
      queries.push({ filing_year: String(y), filing_period: PERIODS[n - 1] });
    }
  } else {
    const { data: prev } = await db.from("ingest_runs").select("started_at")
      .eq("job", "lobbying").eq("status", "succeeded").order("started_at", { ascending: false }).limit(1);
    const since = new Date(new Date(prev?.[0]?.started_at ?? Date.now() - 7 * 864e5).getTime() - 2 * 864e5);
    queries.push({ filing_dt_posted_after: since.toISOString().slice(0, 10) });
  }

  let seen = 0;
  for (const q of queries) {
    for await (const page of pages(q)) {
      seen += page.length;
      await apply(db, page.map((f) => parse(f, tracked)).filter(Boolean), counts);
      if (seen % 2500 < 25) console.log(`  ${seen} read, ${counts.rows_inserted} kept, ${counts.rows_deleted} superseded`);
    }
  }
  console.log(`bill numbers found: ${stats.refs} (${stats.untracked} not in our bills table); non-LD-2 skipped: ${stats.skipped}`);
  console.log(`done: ${seen} filings read, ${counts.rows_inserted} with tracked bills, ${counts.rows_deleted} removed`);
  return counts;
}

const db = getClient();
const counts = { rows_inserted: 0, rows_updated: 0, rows_deleted: 0 };
if (DRY) await run(db, counts);
else await withRun(db, "lobbying", () => run(db, counts));
