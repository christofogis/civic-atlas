// Ingest roll-call votes and each member's position.
// Sources (no API key needed):
//   House:  https://clerk.house.gov/evs/{year}/roll{NNN}.xml
//   Senate: https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_{congress}_{session}.xml
//           https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{NNNNN}.xml
//
//   node scripts/ingest/votes.mjs                    # current Congress, new votes only
//   node scripts/ingest/votes.mjs --congress 118     # backfill another Congress
//   node scripts/ingest/votes.mjs --dry-run --limit 3  # fetch + parse a few, write nothing
//
// Incremental: picks up after the highest roll number already stored, and re-reads the
// last few in case the clerk corrected them. Positions keep the clerk's wording verbatim.
import { XMLParser } from "fast-xml-parser";
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";

const REFETCH_LAST = 3;
const MAX_FETCHES_PER_RUN = 1500;
const PAUSE_MS = 150; // be polite to the clerks' servers

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", parseTagValue: false, trimValues: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (v) => (v == null ? null : typeof v === "object" ? (v["#text"] ?? null) : String(v).trim() || null);
const int = (v) => (text(v) == null ? null : parseInt(text(v), 10));
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

const PARTY = { R: "Republican", D: "Democrat", I: "Independent", ID: "Independent" };
const CATEGORY = {
  yea: "yes", aye: "yes", guilty: "yes",
  nay: "no", no: "no", "not guilty": "no",
  present: "present",
  "not voting": "not_voting",
};
export function category(position) {
  const p = String(position).trim().toLowerCase();
  const c = CATEGORY[p] ?? (p.startsWith("present") ? "present" : null); // e.g. 'Present, Giving Live Pair'
  if (!c) throw new Error(`unknown vote position "${position}"`);
  return c;
}

const BILL_TYPES = new Set(["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"]);
// 'H R 30' / 'H.R. 30' / 'S.J.Res. 12' -> { bill_type: 'hr', bill_number: 30 }; else nulls
export function parseBillRef(ref) {
  const m = String(ref ?? "").match(/^([A-Za-z.\s]+?)\s*(\d+)$/);
  if (!m) return { bill_type: null, bill_number: null };
  const type = m[1].replace(/[.\s]/g, "").toLowerCase();
  return BILL_TYPES.has(type) ? { bill_type: type, bill_number: parseInt(m[2], 10) } : { bill_type: null, bill_number: null };
}

// Wall-clock time in Washington -> ISO timestamp (handles EST/EDT).
export function easternToIso(y, mo, d, h, mi) {
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" })
    .formatToParts(guess).find((p) => p.type === "timeZoneName").value; // e.g. 'GMT-5'
  const hours = parseInt(offset.replace("GMT", "") || "0", 10);
  return new Date(guess.getTime() - hours * 3600_000).toISOString();
}
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export const yearFor = (congress, session) => 1789 + 2 * (congress - 1) + (session - 1);

export function parseHouse(xml, url) {
  const meta = parser.parse(xml)["rollcall-vote"]["vote-metadata"];
  const [d, mon, y] = text(meta["action-date"]).split("-");
  const [h, mi] = (meta["action-time"]?.["@time-etz"] ?? "12:00").split(":").map(Number);
  const totals = meta["vote-totals"]?.["totals-by-vote"] ?? {};
  const legis = text(meta["legis-num"]);
  const ref = parseBillRef(legis);
  const congress = int(meta.congress);
  const vote = {
    chamber: "house",
    congress,
    session: parseInt(text(meta.session), 10),
    roll_number: int(meta["rollcall-num"]),
    voted_at: easternToIso(+y, MONTHS[mon.toLowerCase()], +d, h, mi),
    question: text(meta["vote-question"]) ?? "(no question recorded)",
    vote_type: text(meta["vote-type"]),
    result: text(meta["vote-result"]) ?? "(no result recorded)",
    required: null,
    description: text(meta["vote-desc"]),
    document_name: legis,
    bill_congress: ref.bill_type ? congress : null,
    bill_type: ref.bill_type,
    bill_number: ref.bill_number,
    amendment_ref: text(meta["amendment-num"]),
    yea_total: int(totals["yea-total"]),
    nay_total: int(totals["nay-total"]),
    present_total: int(totals["present-total"]),
    not_voting_total: int(totals["not-voting-total"]),
    source_url: url,
  };
  const recorded = list(parser.parse(xml)["rollcall-vote"]["vote-data"]?.["recorded-vote"]);
  const positions = recorded.map((rv) => ({
    member_ref: rv.legislator["@name-id"],
    position: text(rv.vote),
    party_at_vote: PARTY[rv.legislator["@party"]] ?? rv.legislator["@party"],
    state_at_vote: rv.legislator["@state"],
  }));
  return { vote, positions };
}

export function parseSenate(xml, url) {
  const v = parser.parse(xml).roll_call_vote;
  // "January 9, 2025,  02:54 PM"
  const m = text(v.vote_date).match(/^(\w+)\s+(\d+),\s*(\d{4}),\s+(\d+):(\d+)\s*(AM|PM)$/i);
  if (!m) throw new Error(`unparsed Senate date "${text(v.vote_date)}"`);
  let hour = parseInt(m[4], 10) % 12;
  if (m[6].toUpperCase() === "PM") hour += 12;
  const doc = v.document ?? {};
  const docName = text(doc.document_name);
  const ref = parseBillRef(`${text(doc.document_type) ?? ""} ${text(doc.document_number) ?? ""}`.trim());
  const congress = int(v.congress);
  const count = v.count ?? {};
  const vote = {
    chamber: "senate",
    congress,
    session: int(v.session),
    roll_number: int(v.vote_number),
    voted_at: easternToIso(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2], hour, +m[5]),
    question: text(v.vote_question_text) ?? text(v.question) ?? "(no question recorded)",
    vote_type: null,
    result: text(v.vote_result_text) ?? text(v.vote_result) ?? "(no result recorded)",
    required: text(v.majority_requirement),
    description: text(v.vote_title),
    document_name: docName,
    bill_congress: ref.bill_type ? int(doc.document_congress) ?? congress : null,
    bill_type: ref.bill_type,
    bill_number: ref.bill_number,
    amendment_ref: text(v.amendment?.amendment_number),
    yea_total: int(count.yeas),
    nay_total: int(count.nays),
    present_total: int(count.present),
    not_voting_total: int(count.absent),
    source_url: url,
  };
  const positions = list(v.members?.member).map((mb) => ({
    member_ref: text(mb.lis_member_id),
    position: text(mb.vote_cast),
    party_at_vote: PARTY[text(mb.party)] ?? text(mb.party),
    state_at_vote: text(mb.state),
  }));
  return { vote, positions };
}

async function get(url) {
  await sleep(PAUSE_MS);
  const res = await fetch(url, { headers: { "User-Agent": "civic-atlas (github.com/christofogis/civic-atlas)" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.text();
}

const houseUrl = (year, n) => `https://clerk.house.gov/evs/${year}/roll${String(n).padStart(3, "0")}.xml`;
const senateMenuUrl = (c, s) => `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${c}_${s}.xml`;
const senateUrl = (c, s, n) =>
  `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${c}${s}/vote_${c}_${s}_${String(n).padStart(5, "0")}.xml`;

async function senateCount(congress, session) {
  const xml = await get(senateMenuUrl(congress, session));
  if (!xml) return 0;
  const votes = list(parser.parse(xml).vote_summary?.votes?.vote);
  return votes.reduce((mx, v) => Math.max(mx, int(v.vote_number) ?? 0), 0);
}

async function main() {
  const args = process.argv.slice(2);
  const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const dryRun = args.includes("--dry-run");
  const limit = arg("--limit") ? parseInt(arg("--limit"), 10) : Infinity;

  const db = dryRun ? null : getClient();
  let congress = arg("--congress") ? parseInt(arg("--congress"), 10) : null;
  if (!congress) {
    const today = new Date().toISOString().slice(0, 10);
    if (db) {
      const { data, error } = await db.from("congresses").select("number").lte("start_date", today).gt("end_date", today).single();
      if (error) throw new Error(`no congress covers ${today}`);
      congress = data.number;
    } else {
      congress = Math.floor((new Date().getUTCFullYear() - 1789) / 2) + 1;
    }
  }
  const currentYear = new Date().getUTCFullYear();
  const sessions = [1, 2].filter((s) => yearFor(congress, s) <= currentYear);

  const run = async () => {
    // Map Senate LIS ids and known bioguide ids to members.
    const members = db ? await fetchAll(db, "members", "bioguide_id,lis_id") : [];
    const known = new Set(members.map((m) => m.bioguide_id));
    const byLis = new Map(members.filter((m) => m.lis_id).map((m) => [m.lis_id, m.bioguide_id]));
    const stored = db ? await fetchAll(db, "votes", "chamber,congress,session,roll_number") : [];
    const maxStored = (chamber, s) =>
      stored.filter((v) => v.chamber === chamber && v.congress === congress && v.session === s)
        .reduce((mx, v) => Math.max(mx, v.roll_number), 0);

    let fetched = 0, voteCount = 0, positionCount = 0, unmatched = 0;
    const unmatchedRefs = new Set();
    const save = async ({ vote, positions }) => {
      const rows = [];
      for (const p of positions) {
        const bioguide = vote.chamber === "house" ? p.member_ref : byLis.get(p.member_ref);
        if (db && (!bioguide || !known.has(bioguide))) { unmatched++; unmatchedRefs.add(p.member_ref); continue; }
        rows.push({
          vote_id: `${vote.chamber}-${vote.congress}-${vote.session}-${vote.roll_number}`,
          bioguide_id: bioguide ?? p.member_ref,
          position: p.position,
          position_category: category(p.position),
          party_at_vote: p.party_at_vote,
          state_at_vote: p.state_at_vote,
        });
      }
      if (dryRun) {
        if (voteCount < 2) console.log(JSON.stringify(vote), "\n  sample positions:", JSON.stringify(rows.slice(0, 2)));
      } else {
        await upsertBatches(db, "votes", [vote], "vote_id");
        await upsertBatches(db, "vote_positions", rows, "vote_id,bioguide_id");
      }
      voteCount++;
      positionCount += rows.length;
    };

    for (const s of sessions) {
      // House: walk roll numbers until the clerk returns 404.
      const year = yearFor(congress, s);
      for (let n = Math.max(1, maxStored("house", s) - REFETCH_LAST + 1); fetched < MAX_FETCHES_PER_RUN && voteCount < limit; n++) {
        const url = houseUrl(year, n);
        const xml = await get(url);
        fetched++;
        if (!xml) break;
        await save(parseHouse(xml, url));
      }
      // Senate: the session menu says how many votes exist.
      const total = await senateCount(congress, s);
      fetched++;
      for (let n = Math.max(1, maxStored("senate", s) - REFETCH_LAST + 1); n <= total && fetched < MAX_FETCHES_PER_RUN && voteCount < limit * 2; n++) {
        const url = senateUrl(congress, s, n);
        const xml = await get(url);
        fetched++;
        if (!xml) continue;
        await save(parseSenate(xml, url));
      }
    }
    console.log(`Congress ${congress}: ${voteCount} votes, ${positionCount} positions, ${fetched} fetches`);
    if (unmatched) console.log(`warning: ${unmatched} positions skipped, no matching member: ${[...unmatchedRefs].slice(0, 20).join(", ")}`);
    if (fetched >= MAX_FETCHES_PER_RUN) console.log("fetch cap reached; the next run continues where this one stopped");
    return { rows_inserted: voteCount + positionCount, rows_updated: 0 };
  };

  if (dryRun) await run();
  else await withRun(db, `votes-${congress}`, run);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
