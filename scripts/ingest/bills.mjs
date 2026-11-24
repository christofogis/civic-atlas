// Ingest bills, sponsors, cosponsors and CRS summaries from GovInfo's official Bill Status
// bulk data (the same records Congress.gov is built on). No API key, no rate limit.
//   Listing: https://www.govinfo.gov/bulkdata/json/BILLSTATUS/{congress}/{type}
//   File:    https://www.govinfo.gov/bulkdata/BILLSTATUS/{congress}/{type}/BILLSTATUS-{congress}{type}{n}.xml
//
//   node scripts/ingest/bills.mjs                       # files changed since the last successful run
//   node scripts/ingest/bills.mjs --full                # every file (first load, or to repair)
//   node scripts/ingest/bills.mjs --dry-run --limit 3   # list + parse a few, write nothing
//
// Covers the 118th Congress on, the same window as votes.
import { XMLParser } from "fast-xml-parser";
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";

const CONGRESSES_FROM = 118;
const TYPES = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"];
const CONCURRENCY = 6;
const BATCH = 200;
const LISTING = (c, t) => `https://www.govinfo.gov/bulkdata/json/BILLSTATUS/${c}/${t}`;

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const str = (v) => (v == null || v === "" ? null : String(v));
const yn = (v) => String(v).toUpperCase() === "TRUE" || String(v).toUpperCase() === "Y";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const SLUG = {
  hr: "house-bill", s: "senate-bill", hres: "house-resolution", sres: "senate-resolution",
  hjres: "house-joint-resolution", sjres: "senate-joint-resolution",
  hconres: "house-concurrent-resolution", sconres: "senate-concurrent-resolution",
};
export const billPage = (c, t, n) => `https://www.congress.gov/bill/${ordinal(c)}-congress/${SLUG[t]}/${n}`;

// CRS summaries are stored as plain text: strip any markup and collapse whitespace.
export const plain = (html) =>
  html == null ? null : String(html).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim() || null;

export function parseBillStatus(xml) {
  const b = parser.parse(xml)?.billStatus?.bill;
  if (!b) return null;
  const congress = parseInt(b.congress, 10);
  const bill_type = String(b.type ?? b.billType ?? "").toLowerCase();
  const number = parseInt(b.number ?? b.billNumber, 10);
  if (!congress || !TYPES.includes(bill_type) || !number) return null;
  const summaries = list(b.summaries?.summary ?? b.summaries?.billSummaries?.item)
    .sort((a, z) => String(z.updateDate ?? z.actionDate ?? "").localeCompare(String(a.updateDate ?? a.actionDate ?? "")));
  const sponsor = list(b.sponsors?.item)[0];
  return {
    bill: {
      congress, bill_type, number,
      title: str(b.title) ?? "(untitled)",
      introduced_date: str(b.introducedDate),
      sponsor_bioguide_id: str(sponsor?.bioguideId),
      policy_area: str(b.policyArea?.name),
      latest_action_date: str(b.latestAction?.actionDate),
      latest_action_text: str(b.latestAction?.text),
      crs_summary: plain(summaries[0]?.text),
      source_url: billPage(congress, bill_type, number),
    },
    // One row per person: if someone withdrew and later re-joined, the active entry wins.
    cosponsors: [...list(b.cosponsors?.item).filter((c) => c.bioguideId).reduce((m, c) => {
      const row = {
        congress, bill_type, number,
        bioguide_id: String(c.bioguideId),
        sponsored_date: str(c.sponsorshipDate),
        withdrawn_date: str(c.sponsorshipWithdrawnDate),
        is_original: yn(c.isOriginalCosponsor),
      };
      const prev = m.get(row.bioguide_id);
      if (!prev || (prev.withdrawn_date && !row.withdrawn_date)) m.set(row.bioguide_id, row);
      return m;
    }, new Map()).values()],
  };
}

async function get(url, as = "text") {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { Accept: as === "json" ? "application/json" : "application/xml",
      "User-Agent": "civic-atlas (github.com/christofogis/civic-atlas)" } });
    if (res.status === 404) return null;
    if (res.ok) return as === "json" ? res.json() : res.text();
    if (res.status === 429 || res.status >= 500) { await sleep(5000 * (attempt + 1)); continue; }
    throw new Error(`GET ${url}: HTTP ${res.status}`);
  }
  throw new Error(`GET ${url}: failed after retries`);
}

// Files in a listing, with last-modified time. Accepts the listing's known field spellings.
export function listingFiles(json) {
  return list(json?.files).filter((f) => !f.folder && /\.xml$/i.test(f.name ?? f.link ?? "")).map((f) => ({
    url: f.link ?? f.url,
    modified: new Date(f.lastModified ?? f.formattedLastModifiedTime ?? f.lastModifiedTime ?? 0),
  }));
}

async function mapLimit(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const dryRun = args.includes("--dry-run");
  const limit = arg("--limit") ? parseInt(arg("--limit"), 10) : Infinity;

  const db = getClient();
  const run = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const congresses = (await fetchAll(db, "congresses", "number,start_date"))
      .filter((c) => c.number >= CONGRESSES_FROM && c.start_date <= today).map((c) => c.number);

    // Changed since the last successful run (minus a day of overlap), unless --full.
    let since = new Date(0);
    if (!args.includes("--full") && !dryRun) {
      const { data } = await db.from("ingest_runs").select("started_at").eq("job", "bills")
        .eq("status", "succeeded").order("started_at", { ascending: false }).limit(1);
      if (data?.[0]) since = new Date(new Date(data[0].started_at).getTime() - 86_400_000);
    }

    const todo = [];
    for (const c of congresses) {
      for (const t of TYPES) {
        const json = await get(LISTING(c, t), "json");
        if (dryRun && todo.length === 0) console.log("listing sample:", JSON.stringify(json?.files?.slice(0, 2)));
        todo.push(...listingFiles(json).filter((f) => f.modified > since));
      }
    }
    const work = todo.slice(0, limit);
    console.log(`congresses ${congresses.join(", ")}: ${work.length} bill files to read (since ${since.toISOString().slice(0, 10)})`);

    const known = new Set((await fetchAll(db, "members", "bioguide_id")).map((m) => m.bioguide_id));
    let bills = [], cosponsors = [], billCount = 0, cosponsorCount = 0, unknownPeople = 0, unparsed = 0;
    const flush = async () => {
      if (!bills.length) return;
      const b = bills, c = cosponsors;
      bills = []; cosponsors = [];
      if (dryRun) return;
      await upsertBatches(db, "bills", b, "congress,bill_type,number");
      await upsertBatches(db, "bill_cosponsors", c, "congress,bill_type,number,bioguide_id");
    };

    await mapLimit(work, CONCURRENCY, async (f) => {
      const xml = await get(f.url);
      const parsed = xml && parseBillStatus(xml);
      if (!parsed) { unparsed++; return; }
      const { bill } = parsed;
      if (bill.sponsor_bioguide_id && !known.has(bill.sponsor_bioguide_id)) { unknownPeople++; bill.sponsor_bioguide_id = null; }
      const cos = parsed.cosponsors.filter((c) => known.has(c.bioguide_id) || (unknownPeople++, false));
      if (dryRun && billCount < 2) console.log("sample:", JSON.stringify({ ...bill, crs_summary: bill.crs_summary?.slice(0, 120) }), `cosponsors=${cos.length}`);
      bills.push(bill);
      cosponsors.push(...cos);
      billCount++;
      cosponsorCount += cos.length;
      if (bills.length >= BATCH) await flush();
      if (billCount % 2000 === 0) console.log(`  ${billCount}/${work.length}`);
    });
    await flush();

    console.log(`bills: ${billCount}, cosponsorships: ${cosponsorCount}`);
    if (unknownPeople) console.log(`note: ${unknownPeople} sponsor/cosponsor entries not in members (left before 2023?)`);
    if (unparsed) console.log(`warning: ${unparsed} files could not be parsed`);
    if (dryRun) console.log("dry run: nothing written");
    return { rows_inserted: 0, rows_updated: billCount + cosponsorCount };
  };

  if (dryRun) await run();
  else await withRun(db, "bills", run);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
