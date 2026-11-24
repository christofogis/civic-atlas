// Committee hearings, markups and business meetings in both chambers, from the Congress.gov
// API (committee-meeting). Lists every meeting each run and reads only those new or updated
// since we last saw them, so it is safe to re-run and resumes where a capped run stopped.
//   node scripts/ingest/meetings.mjs [--limit N] [--dry-run]
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { congressOn } from "../../lib/congress.js";
import { parseMeeting } from "../../lib/meetings.js";

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const DRY = args.includes("--dry-run");
const LIMIT = arg("--limit") ? parseInt(arg("--limit"), 10) : 2500;   // detail reads per run
const KEY = process.env.DATA_GOV_API_KEY;
const FROM = 118;
const PACE_MS = 1100;   // ~3,300 calls/hour, under the 5,000/hour the key allows
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!KEY) throw new Error("DATA_GOV_API_KEY is not set");

async function api(url) {
  const u = new URL(url);
  u.searchParams.set("format", "json");
  u.searchParams.set("api_key", KEY);
  for (let i = 0; ; i++) {
    await sleep(PACE_MS);
    const res = await fetch(u, { headers: { Accept: "application/json" } });
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    if (i >= 4) throw new Error(`Congress.gov ${res.status} for ${u.pathname}`);   // never echo the key
    await sleep(res.status === 429 ? 60_000 : 5_000 * (i + 1));
  }
}

const db = getClient();
const run = async () => {
  const seen = new Map((await fetchAll(db, "committee_meetings", "event_id,updated_at_source"))
    .map((m) => [m.event_id, m.updated_at_source ? new Date(m.updated_at_source).getTime() : 0]));
  const todo = [];
  for (let c = congressOn(); c >= FROM; c--) {
    for (const chamber of ["house", "senate"]) {
      let next = `https://api.congress.gov/v3/committee-meeting/${c}/${chamber}?limit=250`;
      let listed = 0;
      while (next) {
        const page = await api(next);
        for (const m of page?.committeeMeetings ?? []) {
          listed++;
          const updated = m.updateDate ? new Date(m.updateDate).getTime() : Infinity;
          if (!seen.has(String(m.eventId)) || updated > seen.get(String(m.eventId))) todo.push(m.url);
        }
        next = page?.pagination?.next ?? null;
      }
      console.log(`${c} ${chamber}: ${listed} meetings listed`);
    }
  }
  const work = todo.slice(0, LIMIT);
  console.log(`${todo.length} new or updated; reading ${work.length}`);

  let rows = [], written = 0, skipped = 0;
  const flush = async () => {
    const r = rows; rows = [];
    if (!DRY && r.length) await upsertBatches(db, "committee_meetings", r, "event_id", 200);
    written += r.length;
  };
  for (const url of work) {
    const body = await api(url);
    const row = body?.committeeMeeting && parseMeeting(body.committeeMeeting);
    if (!row) { skipped++; continue; }
    if (DRY && written + rows.length < 2) console.log(JSON.stringify(row).slice(0, 1500));
    rows.push(row);
    if (rows.length >= 200) await flush();
  }
  await flush();
  console.log(`meetings written: ${written}${skipped ? `, unreadable: ${skipped}` : ""}${todo.length > work.length ? `; ${todo.length - work.length} left for the next run` : ""}${DRY ? " (dry run: nothing written)" : ""}`);
  return { rows_inserted: written, rows_updated: 0 };
};

(DRY ? run() : withRun(db, "meetings", run)).catch((err) => { console.error(err.message); process.exit(1); });
