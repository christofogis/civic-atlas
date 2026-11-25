// Compare consecutive full-text versions of each bill, section by section, from GPO's XML.
// Runs daily after the bills job; only bills with a version not yet compared are read, so it
// is safe to re-run and resumes where a capped run stopped.
//   node scripts/ingest/bill-text.mjs [--limit N] [--dry-run] [--recompute]
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { sectionsFromXml, compareSections } from "../../lib/billtext.js";

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const DRY = args.includes("--dry-run");
const RECOMPUTE = args.includes("--recompute");   // compare every bill again (after a change to the method)
const LIMIT = arg("--limit") ? parseInt(arg("--limit"), 10) : 4000;   // bills per run
const CONCURRENCY = 4;
const UA = { headers: { "User-Agent": "civic-atlas ingest (github.com/christofogis/civic-atlas)" } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, UA);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // GovInfo answers a missing file with an HTML error page and status 200.
      if (/^\s*<!DOCTYPE html/i.test(text)) return null;
      return text;
    } catch (err) {
      if (i >= 3) throw new Error(`${url}: ${err.message}`);
      await sleep(2000 * (i + 1));
    }
  }
}

async function mapLimit(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

const db = getClient();
const run = async () => {
  const versions = await fetchAll(db, "bill_text_versions", "congress,bill_type,number,version_code,seq,version_name,version_date,xml_url,full_text");
  const done = RECOMPUTE ? new Set() : new Set((await fetchAll(db, "bill_version_changes", "congress,bill_type,number,from_code,to_code"))
    .map((c) => `${c.congress}|${c.bill_type}|${c.number}|${c.from_code}|${c.to_code}`));
  const byBill = new Map();
  for (const v of versions) {
    if (v.version_code === "law") continue;   // public law text is in a different format; linked only
    const k = `${v.congress}|${v.bill_type}|${v.number}`;
    byBill.set(k, [...(byBill.get(k) ?? []), v]);
  }
  // A bill needs work when a version hasn't been checked, or two consecutive full texts haven't been compared.
  const todo = [];
  for (const [k, vs] of byBill) {
    if (vs.length < 2) continue;
    vs.sort((a, z) => a.seq - z.seq);
    const full = vs.filter((v) => RECOMPUTE || v.full_text !== false);
    const pending = full.some((v) => v.full_text == null) || full.slice(1).some((v, i) => !done.has(`${k}|${full[i].version_code}|${v.version_code}`));
    if (pending) todo.push(vs);
  }
  // Newest Congress first, so current bills are compared before the backfill finishes.
  todo.sort((a, z) => z[0].congress - a[0].congress);
  const work = todo.slice(0, LIMIT);
  console.log(`${byBill.size} bills with text; ${todo.length} need comparing; doing ${work.length}`);

  let compared = 0, checked = 0, missing = 0;
  let versionRows = [], changeRows = [];
  const flush = async () => {
    const v = versionRows, c = changeRows;
    versionRows = []; changeRows = [];
    if (DRY) return;
    await upsertBatches(db, "bill_text_versions", v, "congress,bill_type,number,version_code");
    await upsertBatches(db, "bill_version_changes", c, "congress,bill_type,number,from_code,to_code", 100);
  };

  const failed = [];
  await mapLimit(work, CONCURRENCY, async (vs) => {
    const sections = new Map();
    let gap = false;
    for (const v of vs) {
      if (v.full_text === false && !RECOMPUTE) continue;
      let xml;
      try { xml = await get(v.xml_url); }
      catch (err) {
        // A server error on one file (after retries) shouldn't stop every other bill: count it,
        // leave this bill uncompared, and the next run tries it again.
        failed.push(err.message); gap = true; continue;
      }
      if (xml == null) { missing++; gap = true; continue; }   // not published yet; tried again next run
      const s = sectionsFromXml(xml);
      checked++;
      if (v.full_text !== (s != null)) versionRows.push({ ...v, full_text: s != null });
      if (s) sections.set(v.version_code, s);
    }
    // Compare only when every version could be read, so a late file never leaves a pair that skips it.
    const full = gap ? [] : vs.filter((v) => sections.has(v.version_code));
    for (let i = 1; i < full.length; i++) {
      const a = full[i - 1], b = full[i];
      const row = { congress: b.congress, bill_type: b.bill_type, number: b.number, from_code: a.version_code, to_code: b.version_code,
        ...compareSections(sections.get(a.version_code), sections.get(b.version_code)) };
      if (DRY && compared < 3) console.log(JSON.stringify({ ...row, added: row.added.slice(0, 3), removed: row.removed.slice(0, 3), changed: row.changed.slice(0, 3) }));
      changeRows.push(row);
      compared++;
    }
    if (changeRows.length >= 200) await flush();
  });
  await flush();
  console.log(`versions read: ${checked}, comparisons: ${compared}, not yet published: ${missing}, failed after retries: ${failed.length}${DRY ? " (dry run: nothing written)" : ""}`);
  for (const f of failed.slice(0, 10)) console.log(`  ${f}`);
  // Many failures means GovInfo itself is down: fail the run so it shows in ingest_runs.
  if (failed.length > 20) throw new Error(`${failed.length} files failed after retries, e.g. ${failed[0]}`);
  return { rows_inserted: compared, rows_updated: 0 };
};

(DRY ? run() : withRun(db, "bill-text", run)).catch((err) => { console.error(err.message); process.exit(1); });
