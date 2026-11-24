// Ingest bills sponsored and cosponsored by members, from the Congress.gov API.
// Needs DATA_GOV_API_KEY (an api.data.gov key; sent as a header, never in URLs or logs).
//
//   node scripts/ingest/bills.mjs                      # serving members + former members not yet loaded
//   node scripts/ingest/bills.mjs --dry-run --limit 2  # fetch a couple of members, write nothing
//
// Covers the 118th Congress onward (same window as votes). Each member's lists come back
// newest first, so paging stops once it reaches older Congresses.
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";

const API = "https://api.congress.gov/v3";
const FROM_CONGRESS = 118;
const PAGE = 250;
const PAUSE_MS = 250;
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
    if (res.status === 429) { await sleep(60_000); continue; } // rate limited: wait a minute
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
    return res.json();
  }
  throw new Error(`GET ${url}: still rate limited`);
}

// All items for one member's list, newest first, stopping before FROM_CONGRESS.
async function memberList(bioguide, kind, key) {
  const listKey = kind === "sponsored" ? "sponsoredLegislation" : "cosponsoredLegislation";
  const items = [];
  for (let offset = 0; ; offset += PAGE) {
    const data = await getJson(`${API}/member/${bioguide}/${kind}-legislation?format=json&limit=${PAGE}&offset=${offset}`, key);
    const page = data?.[listKey] ?? [];
    items.push(...page);
    const reachedOld = page.some((i) => parseInt(i.congress, 10) < FROM_CONGRESS);
    if (page.length < PAGE || reachedOld || !data?.pagination?.next) break;
  }
  return items.filter((i) => parseInt(i.congress, 10) >= FROM_CONGRESS);
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
    const members = (await fetchAll(db, "members", "bioguide_id")).map((r) => r.bioguide_id);
    const withBills = new Set((await fetchAll(db, "bills", "sponsor_bioguide_id")).map((r) => r.sponsor_bioguide_id));
    // Former members' records don't change, so load them once.
    const todo = members.filter((b) => serving.has(b) || !withBills.has(b)).slice(0, limit);
    console.log(`members to refresh: ${todo.length} (${serving.size} serving)`);

    const sponsored = new Map();   // bill key -> row with sponsor
    const cosponsoredOnly = new Map();
    const cosponsors = [];
    const k = (b) => `${b.congress}|${b.bill_type}|${b.number}`;
    let done = 0;
    for (const bioguide of todo) {
      for (const item of await memberList(bioguide, "sponsored", key)) {
        const bill = mapItem(item);
        if (bill) sponsored.set(k(bill), { ...bill, sponsor_bioguide_id: bioguide });
      }
      for (const item of await memberList(bioguide, "cosponsored", key)) {
        const bill = mapItem(item);
        if (!bill) continue;
        cosponsoredOnly.set(k(bill), bill);
        cosponsors.push({ congress: bill.congress, bill_type: bill.bill_type, number: bill.number, bioguide_id: bioguide });
      }
      if (++done % 50 === 0) console.log(`  ${done}/${todo.length} members`);
    }
    for (const key2 of sponsored.keys()) cosponsoredOnly.delete(key2);
    console.log(`bills: ${sponsored.size} with sponsor, ${cosponsoredOnly.size} cosponsored only; ${cosponsors.length} cosponsorships`);

    if (dryRun) {
      console.log("sample bill:", JSON.stringify([...sponsored.values()][0] ?? null));
      console.log("dry run: nothing written");
      return { rows_inserted: 0, rows_updated: 0 };
    }
    // Separate batches so a cosponsor-only row never blanks out a known sponsor.
    await upsertBatches(db, "bills", [...sponsored.values()], "congress,bill_type,number");
    if (cosponsoredOnly.size) {
      const existing = new Set((await fetchAll(db, "bills", "congress,bill_type,number")).map(k));
      await upsertBatches(db, "bills", [...cosponsoredOnly.values()].filter((b) => !existing.has(k(b))), "congress,bill_type,number");
    }
    await upsertBatches(db, "bill_cosponsors", cosponsors, "congress,bill_type,number,bioguide_id");
    return { rows_inserted: 0, rows_updated: sponsored.size + cosponsoredOnly.size + cosponsors.length };
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
