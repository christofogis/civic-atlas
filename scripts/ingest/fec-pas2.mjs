// Contributions from other committees (PACs, party and candidate committees) to a candidate's
// own committees, totaled per giving committee, from the FEC bulk file "Contributions from
// committees to candidates & independent expenditures" (pas2{yy}.zip; no key). The file is
// reported by the giving committee; columns per
// https://www.fec.gov/campaign-finance-data/contributions-committees-candidates-file-description/
//
// Counted: transaction types 24K (contribution made to a nonaffiliated committee) and 24Z
// (in-kind contribution), only where the recipient (OTHER_ID) is one of the candidate's
// principal or authorized committees (designation P or A in the candidate-committee linkage
// file, ccl{yy}.zip). Memo rows are included, as the FEC's file description advises for bulk
// data (in pas226, Coons's had six memo 24K rows from corporate PACs, $1,000-$2,500 each).
// Amounts are summed with their sign, so a refund or void the giving committee reported as a
// negative entry is netted out. Rows whose memo text mentions an earmark are left out: an
// earmarked contribution is the individual's money passed through the committee, not the
// committee's own gift (AIPAC PAC reported a -$6 "VOID: REFUNDED EARMARK" row to Coons). Not counted: independent expenditures (24E, 24A), party
// coordinated expenditures (24C), communication costs (24F, 24N) and other types in the file.
//
// Pure helpers are exported for tests; downloads stream the zip through `unzip -p`.
import { spawn } from "node:child_process";
import { createWriteStream, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const BULK = "https://www.fec.gov/files/bulk-downloads";
export const DIRECT_TYPES = new Set(["24K", "24Z"]);
export const EARMARK = /EARMARK/i;
const yy = (cycle) => String(cycle).slice(2);

// pas2 columns (pipe-delimited, no header).
const PAS2 = ["CMTE_ID", "AMNDT_IND", "RPT_TP", "TRANSACTION_PGI", "IMAGE_NUM", "TRANSACTION_TP", "ENTITY_TP", "NAME",
  "CITY", "STATE", "ZIP_CODE", "EMPLOYER", "OCCUPATION", "TRANSACTION_DT", "TRANSACTION_AMT", "OTHER_ID", "CAND_ID",
  "TRAN_ID", "FILE_NUM", "MEMO_CD", "MEMO_TEXT", "SUB_ID"];
export function parsePas2(line) {
  const f = line.split("|");
  if (f.length < PAS2.length) return null;
  return Object.fromEntries(PAS2.map((k, i) => [k, f[i]]));
}

// Candidate-committee linkage rows -> Map committee ID -> Set of candidate IDs it is authorized for.
// ccl columns: CAND_ID|CAND_ELECTION_YR|FEC_ELECTION_YR|CMTE_ID|CMTE_TP|CMTE_DSGN|LINKAGE_ID
export function authorizedIndex(cclLines, wanted) {
  const idx = new Map();
  for (const line of cclLines) {
    const [cand, , , cmte, , dsgn] = line.split("|");
    if (!wanted.has(cand) || !["P", "A"].includes(dsgn) || !cmte) continue;
    if (!idx.has(cmte)) idx.set(cmte, new Set());
    idx.get(cmte).add(cand);
  }
  return idx;
}

// Add one pas2 row to the running totals: Map candidate -> Map giver -> { total, contributions }.
// Totals are kept in cents to avoid floating-point drift.
export function addRow(totals, row, authorized) {
  if (!row || !DIRECT_TYPES.has(row.TRANSACTION_TP)) return false;
  if (EARMARK.test(row.MEMO_TEXT ?? "")) return false;
  const cands = authorized.get(row.OTHER_ID);
  if (!cands) return false;
  const cents = Math.round(Number(row.TRANSACTION_AMT || 0) * 100);
  if (!Number.isFinite(cents)) return false;
  for (const cand of cands) {
    if (!totals.has(cand)) totals.set(cand, new Map());
    const byGiver = totals.get(cand);
    const cur = byGiver.get(row.CMTE_ID) ?? { cents: 0, contributions: 0 };
    cur.cents += cents;
    if (cents > 0) cur.contributions++;
    byGiver.set(row.CMTE_ID, cur);
  }
  return true;
}

// One candidate's givers -> ranked rows: largest net total first, ties by name. Keeps the top
// `top` and every giver tied with the last of them (up to `cap`), so a cut never falls inside a
// tie. Givers whose net total is zero or less (fully refunded) are left out.
export function rankGivers(byGiver, names, { top = 10, cap = 100 } = {}) {
  const list = [...(byGiver ?? new Map())]
    .filter(([, v]) => v.cents > 0)
    .map(([id, v]) => ({ id, name: names.get(id) ?? id, cents: v.cents, contributions: v.contributions }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  if (list.length <= top) return list;
  const floor = list[top - 1].cents;
  return list.filter((g, i) => i < top || g.cents === floor).slice(0, cap);
}

// ---- Downloads ------------------------------------------------------------------------------

async function download(url, file) {
  const res = await fetch(url, { headers: { "User-Agent": "civic-atlas ingest" } });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
  const modified = res.headers.get("last-modified");
  return modified ? new Date(modified).toISOString().slice(0, 10) : null;
}

// Each line of the single text file inside a zip, streamed.
async function* zipLines(file) {
  const child = spawn("unzip", ["-p", file], { stdio: ["ignore", "pipe", "inherit"] });
  const done = new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`unzip exited ${code}`))));
  });
  child.stdout.setEncoding("latin1");
  for await (const line of createInterface({ input: child.stdout, crlfDelay: Infinity })) yield line;
  await done;
}

// For one cycle and the candidate IDs wanted: { asOf, totals, names, rowsCounted }.
export async function committeeGifts(cycle, candIds, log = console.log) {
  const dir = mkdtempSync(join(tmpdir(), "pas2-"));
  try {
    const y = yy(cycle);
    const wanted = new Set(candIds);
    await download(`${BULK}/${cycle}/ccl${y}.zip`, join(dir, "ccl.zip"));
    const ccl = [];
    for await (const line of zipLines(join(dir, "ccl.zip"))) ccl.push(line);
    const authorized = authorizedIndex(ccl, wanted);

    // Giving committees' names (cm{yy}: CMTE_ID|CMTE_NM|...).
    await download(`${BULK}/${cycle}/cm${y}.zip`, join(dir, "cm.zip"));
    const names = new Map();
    for await (const line of zipLines(join(dir, "cm.zip"))) {
      const [id, name] = line.split("|");
      if (id && name) names.set(id, name.trim());
    }

    const asOf = await download(`${BULK}/${cycle}/pas2${y}.zip`, join(dir, "pas2.zip"));
    const totals = new Map();
    let read = 0, counted = 0, earmarks = 0;
    for await (const line of zipLines(join(dir, "pas2.zip"))) {
      read++;
      const row = parsePas2(line);
      if (addRow(totals, row, authorized)) counted++;
      else if (row && DIRECT_TYPES.has(row.TRANSACTION_TP) && authorized.has(row.OTHER_ID) && EARMARK.test(row.MEMO_TEXT)) {
        earmarks++; // memo text often names the individual donor, so it isn't logged
      }
    }
    log(`pas2 ${cycle} (FEC file dated ${asOf ?? "?"}): ${read} rows, ${counted} direct contributions to ${totals.size} of ${wanted.size} candidates' committees; ${earmarks} earmark rows left out`);
    return { asOf, totals, names, rowsCounted: counted };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
