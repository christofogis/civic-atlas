// Ingest bills sponsored and cosponsored by members, from the Congress.gov API.
// Needs DATA_GOV_API_KEY (an api.data.gov key; sent as a header, never in URLs or logs).
//
//   node scripts/ingest/bills.mjs                      # full: every page back to the 118th Congress
//   node scripts/ingest/bills.mjs --max-pages 2        # daily: each member's ~500 most recent bills
//   node scripts/ingest/bills.mjs --dry-run --limit 2  # fetch a couple of members, write nothing
//
// Covers the 118th Congress onward (same window as votes). Each member's lists come back
// newest first by introduced date, so paging stops once it passes Jan 3, 2023. (The
// `congress` field on list items isn't reliable for this: older numbers appear mixed in.)
// Congress.gov allows ~5,000 requests/hour per key; requests are paced to ~3,600/hour.
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";

const API = "https://api.congress.gov/v3";
const FROM_CONGRESS = 118;
const PAGE = 250;
const FROM_DATE = "2023-01-03"; // start of the 118th Congress
const PAUSE_MS = 700;
const BILL_TYPES = new Set(["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"]);
const SLUG = {
  hr: "house-bill", s: "senate-bill", hres: "house-resolution", sres: "senate-resolution",
  hjres: "house-joint-resolution", sjres: "senate-joint-resolution",
  hconres: "house-concurrent-resolution", sconres: "senate-concurrent-resolution",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
export const billPage = (c, t, n) => `https://www.congress.gov/bill/${ordinal(c)}-congress/${SLUG[t]}/${n}`;

// One list item -> bill row (or null for amendments and anything that isn't a bill).
export function mapItem(item) {
  const type = String(item.type ?? "").toLowerCase();
  const number = parseInt(item.number, 10);
  const congress = parseInt(item.congress, 10);
  if (!BILL_TYPES.has(type) || !number || !congress) return null;
  return {
    congress, bill_type: type, number,
    title: item.title ?? item.latestTitle ?? "(untitled)",
    introduced_date: item.introducedDate ?? null,
    policy_area: item.policyArea?.name ?? null,
    latest_action_date: item.latestAction?.actionDate ?? null,
    latest_action_text: item.latestAction?.text ?? null,
    source_url: billPage(congress, type, number),
  };
}

async function getJson(url, key) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(PAUSE_MS);
    const res = await fetch(url, { headers: { "X-Api-Key": key, Accept: "application/json" } });
    if (res.status === 429) { console.log("  rate limited; waiting a minute"); await sleep(60_000); continue; }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
    return res.json();
  }
  throw new Error(`GET ${url}: still rate limited`);
}

// All items for one member's list from the 118th Congress on (newest first, stops by date).
async function memberList(bioguide, kind, key, maxPages = Infinity) {
  const listKey = kind === "sponsored" ? "sponsoredLegislation" : "cosponsoredLegislation";
  const items = [];
  for (let offset = 0, pages = 0; pages < maxPages; offset += PAGE, pages++) {
    const data = await getJson(`${API}/member/${bioguide}/${kind}-legislation?format=json&limit=${PAGE}&offset=${offset}`, key);
    const page = data?.[listKey] ?? [];
    items.push(...page);
    if (process.env.DEBUG_PAGES) {
      const cs = page.map((i) => parseInt(i.congress, 10)).filter(Boolean);
      console.log(`  ${bioguide} ${kind} offset=${offset} items=${page.length} congress ${Math.max(...cs)}..${Math.min(...cs)} first=${page[0]?.introducedDate} last=${page.at(-1)?.introducedDate} total=${data?.pagination?.count}`);
    }
    // A few old items appear out of order, so judge by the page's last (oldest) entry.
    const lastDate = page.at(-1)?.introducedDate;
    const reachedOld = Boolean(lastDate && lastDate < FROM_DATE);
    if (page.length < PAGE || reachedOld || !data?.pagination?.next) break;
  }
  return items.filter((i) => parseInt(i.congress, 10) >= FROM_CONGRESS);
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const dryRun = args.includes("--dry-run");
  const limit = arg("--limit") ? parseInt(arg("--limit"), 10) : Infinity;
  const maxPages = arg("--max-pages") ? parseInt(arg("--max-pages"), 10) : Infinity;
  const key = process.env.DATA_GOV_API_KEY;
  if (!key) throw new Error("DATA_GOV_API_KEY must be set");

  const db = getClient();
  const run = async () => {
    const serving = new Set((await fetchAll(db, "seat_holders", "bioguide_id")).map((r) => r.bioguide_id));
    const members = (await fetchAll(db, "members", "bioguide_id")).map((r) => r.bioguide_id);
    const withBills = new Set((await fetchAll(db, "bills", "sponsor_bioguide_id")).map((r) => r.sponsor_bioguide_id));
    // Former members' records don't change, so load them once.
    const only = arg("--member");
    const todo = only ? [only] : members.filter((b) => serving.has(b) || !withBills.has(b)).slice(0, limit);
    console.log(`members to refresh: ${todo.length} (${serving.size} serving)`);

    // Saved member by member, so a failure late in the run keeps what was already done.
    const k = (b) => `${b.congress}|${b.bill_type}|${b.number}`;
    const known = dryRun ? new Set() : new Set((await fetchAll(db, "bills", "congress,bill_type,number")).map(k));
    let sponsoredTotal = 0, cosponsorTotal = 0, done = 0;
    for (const bioguide of todo) {
      const sponsored = new Map();
      for (const item of await memberList(bioguide, "sponsored", key, maxPages)) {
        const bill = mapItem(item);
        if (bill) sponsored.set(k(bill), { ...bill, sponsor_bioguide_id: bioguide });
      }
      const cosponsoredOnly = new Map();
      const cosponsors = new Map(); // keyed, in case a list shifts between pages
      for (const item of await memberList(bioguide, "cosponsored", key, maxPages)) {
        const bill = mapItem(item);
        if (!bill) continue;
        if (!known.has(k(bill)) && !sponsored.has(k(bill))) cosponsoredOnly.set(k(bill), bill);
        cosponsors.set(k(bill), { congress: bill.congress, bill_type: bill.bill_type, number: bill.number, bioguide_id: bioguide });
      }
      if (dryRun) {
        if (done === 0) console.log("sample bill:", JSON.stringify([...sponsored.values()][0] ?? null));
      } else {
        // Separate batches so a cosponsor-only row never blanks out a known sponsor.
        await upsertBatches(db, "bills", [...sponsored.values()], "congress,bill_type,number");
        await upsertBatches(db, "bills", [...cosponsoredOnly.values()], "congress,bill_type,number");
        await upsertBatches(db, "bill_cosponsors", [...cosponsors.values()], "congress,bill_type,number,bioguide_id");
      }
      for (const key2 of [...sponsored.keys(), ...cosponsoredOnly.keys()]) known.add(key2);
      sponsoredTotal += sponsored.size;
      cosponsorTotal += cosponsors.size;
      if (++done % 50 === 0) console.log(`  ${done}/${todo.length} members`);
    }
    console.log(`bills: ${sponsoredTotal} sponsored; ${cosponsorTotal} cosponsorships`);
    if (dryRun) console.log("dry run: nothing written");
    return { rows_inserted: 0, rows_updated: sponsoredTotal + cosponsorTotal };
  };

  if (dryRun) await run();
  else await withRun(db, maxPages === Infinity ? "bills" : "bills-recent", run);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
