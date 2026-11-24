// Ingest STOCK Act Periodic Transaction Reports (members' stock trades) from both chambers.
//   House:  https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip (index)
//           https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{year}/{DocID}.pdf
//   Senate: https://efdsearch.senate.gov (public-use agreement, then report search and pages)
//
// The Senate's public-use agreement is accepted automatically, as authorized by the project
// owner for Civic Atlas's free, non-commercial public use (5 U.S.C. § 13107).
//
// Needs `pdftotext`, `pdffonts` (poppler-utils) and `unzip` on the PATH.
//
//   node scripts/ingest/trades.mjs                     # new filings since the last run
//   node scripts/ingest/trades.mjs --dry-run --limit 5 # parse a few per chamber, write nothing
//   node scripts/ingest/trades.mjs --chamber house     # one chamber only
//
// Filings are immutable (amendments arrive as new filings), so only unseen filing IDs are read.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { XMLParser } from "fast-xml-parser";
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { parseHousePtrText, parseSenatePtrHtml, isoDate } from "../../lib/ptr.js";

const FROM_YEAR = 2025;
const PAUSE_MS = 400;
const UA = "civic-atlas (github.com/christofogis/civic-atlas)";
const HOUSE = "https://disclosures-clerk.house.gov/public_disc";
const SENATE = "https://efdsearch.senate.gov";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
// Surname for matching: drop generational suffixes ("King, Jr.", "Justice II", "Hagerty IV").
const SUFFIX = /[,\s]+(jr|sr|ii|iii|iv|v)\.?$/i;
const surname = (s) => norm(String(s ?? "").replace(SUFFIX, ""));
const lastWord = (s) => norm(String(s ?? "").replace(SUFFIX, "").trim().split(/[\s-]+/).pop());
// "Delaney" matches "McClain Delaney"; "Lujan" matches "Luján".
const sameSurname = (filed, member) => {
  const a = surname(filed), b = surname(member);
  if (!a || !b) return false;
  return a === b || lastWord(filed) === b || a === lastWord(member) || lastWord(filed) === lastWord(member);
};

async function get(url, opts = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await sleep(PAUSE_MS);
    const res = await fetch(url, { ...opts, headers: { "User-Agent": UA, ...(opts.headers ?? {}) } });
    if (res.status === 404) return null;
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) { await sleep(5000 * (attempt + 1)); continue; }
    throw new Error(`GET ${url.split("?")[0]}: HTTP ${res.status}`);
  }
  throw new Error(`GET ${url.split("?")[0]}: failed after retries`);
}

// ---------- matching filers to members ----------

const addDays = (iso, n) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);

function memberMatcher(members, terms) {
  const byId = new Map(members.map((m) => [m.bioguide_id, m]));
  // A term covers a filing if it was in force on the filing date, or ended within the year
  // before it: members who leave still file reports for trades made while serving.
  const covering = (t, day) => day >= t.start_date && day <= addDays(t.end_date, 365);
  return {
    house(last, stateDst, day) {
      const state = stateDst.slice(0, 2);
      const district = parseInt(stateDst.slice(2), 10);
      const inState = terms.filter((t) => t.chamber === "house" && t.state === state && covering(t, day));
      const named = inState.filter((t) => sameSurname(last, byId.get(t.bioguide_id)?.last_name));
      const exact = named.find((t) => t.district === district || inState.length === 1);
      const ids = [...new Set(named.map((t) => t.bioguide_id))];
      return exact?.bioguide_id ?? (ids.length === 1 ? ids[0] : null);
    },
    senate(first, last, day) {
      const firstN = norm(first).slice(0, 3);
      const named = terms.filter((t) => t.chamber === "senate" && covering(t, day)
        && sameSurname(last, byId.get(t.bioguide_id)?.last_name));
      const ids = [...new Set(named.map((t) => t.bioguide_id))];
      if (ids.length <= 1) return ids[0] ?? null;
      const m = ids.filter((id) => [byId.get(id).first_name, byId.get(id).middle_name, byId.get(id).nickname].some((n) => n && norm(n).startsWith(firstN)));
      return m.length === 1 ? m[0] : null;
    },
  };
}

// ---------- House ----------

async function houseFilings(years, seen, limit) {
  const tmp = mkdtempSync(join(tmpdir(), "ptr-"));
  const parser = new XMLParser({ parseTagValue: false });
  const out = [];
  for (const year of years) {
    const res = await get(`${HOUSE}/financial-pdfs/${year}FD.zip`);
    if (!res) continue;
    const zip = join(tmp, `${year}.zip`);
    writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    const xml = execFileSync("unzip", ["-p", zip, `${year}FD.xml`], { maxBuffer: 64 * 1024 * 1024 }).toString();
    const rows = [].concat(parser.parse(xml)?.FinancialDisclosure?.Member ?? []);
    for (const r of rows) {
      if (r.FilingType !== "P") continue;
      const id = `house-${r.DocID}`;
      if (seen.has(id)) continue;
      out.push({ id, year, r });
    }
  }
  out.sort((a, b) => (isoDate(b.r.FilingDate) ?? "").localeCompare(isoDate(a.r.FilingDate) ?? ""));
  return { list: out.slice(0, limit), tmp };
}

async function readHouseFiling({ id, year, r }, tmp) {
  const url = `${HOUSE}/ptr-pdfs/${year}/${r.DocID}.pdf`;
  const res = await get(url);
  if (!res) return null;
  const pdf = join(tmp, `${r.DocID}.pdf`);
  writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));
  const fonts = execFileSync("pdffonts", [pdf]).toString().split("\n").slice(2).filter((l) => l.trim()).length;
  const text = fonts ? execFileSync("pdftotext", ["-layout", pdf, "-"], { maxBuffer: 32 * 1024 * 1024 }).toString() : "";
  const scanned = !fonts || !/Filing ID/i.test(text);
  return {
    filing: {
      filing_id: id, chamber: "house",
      filer_name: [r.Prefix, r.First, r.Last, r.Suffix].filter(Boolean).join(" "),
      filed_date: isoDate(r.FilingDate), format: scanned ? "scanned" : "electronic",
      is_amendment: /amendment/i.test(text.slice(0, 2000)), source_url: url,
    },
    match: { last: r.Last, stateDst: String(r.StateDst ?? "") },
    rows: scanned ? [] : parseHousePtrText(text),
  };
}

// ---------- Senate ----------

async function senateSession() {
  const cookies = new Map();
  const keep = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };
  const jar = () => [...cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  const home = keep(await get(`${SENATE}/search/home/`));
  const token = (await home.text()).match(/name="csrfmiddlewaretoken" value="([^"]+)"/)?.[1];
  if (!token) throw new Error("Senate eFD: no form token on the agreement page");
  // Accepting the agreement answers with a redirect; keep its cookies rather than follow it.
  await sleep(PAUSE_MS);
  const agreed = keep(await fetch(`${SENATE}/search/home/`, {
    method: "POST", redirect: "manual",
    headers: { "User-Agent": UA, Cookie: jar(), Referer: `${SENATE}/search/home/`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ prohibition_agreement: "1", csrfmiddlewaretoken: token }),
  }));
  if (agreed.status >= 400) throw new Error(`Senate eFD: agreement step returned HTTP ${agreed.status}`);
  if (!cookies.get("csrftoken")) throw new Error("Senate eFD: no session token after the agreement step");
  return { jar, csrf: () => cookies.get("csrftoken") };
}

async function senateFilings(session, since, seen, limit) {
  const out = [];
  for (let start = 0; out.length < limit; start += 100) {
    const res = await get(`${SENATE}/search/report/data/`, {
      method: "POST",
      headers: { Cookie: session.jar(), Referer: `${SENATE}/search/`, "X-CSRFToken": session.csrf(),
        "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        start: String(start), length: "100", report_types: "[11]", filer_types: "[]",
        submitted_start_date: since, submitted_end_date: "", candidate_state: "", senator_state: "",
        office_id: "", first_name: "", last_name: "", csrfmiddlewaretoken: session.csrf(),
      }),
    });
    const page = await res.json();
    for (const [first, last, office, link, date] of page.data ?? []) {
      const href = link.match(/href="([^"]+)"/)?.[1];
      if (!href || !/\(Senator\)/.test(office)) continue;
      const id = `senate-${href.split("/").filter(Boolean).pop()}`;
      if (!seen.has(id)) out.push({ id, href, first, last, office, title: link.replace(/<[^>]+>/g, ""), date });
    }
    if ((page.data ?? []).length < 100) break;
  }
  return out.slice(0, limit);
}

async function readSenateFiling(f, session) {
  const url = SENATE + f.href;
  const res = await get(url, { headers: { Cookie: session.jar() } });
  if (!res) return null;
  const html = await res.text();
  const rows = /\/view\/paper\//.test(f.href) ? null : parseSenatePtrHtml(html);
  return {
    filing: {
      filing_id: f.id, chamber: "senate", filer_name: f.office.replace(/\s*\(Senator\)\s*/, ""),
      filed_date: isoDate(f.date), format: rows ? "electronic" : "scanned",
      is_amendment: /amendment/i.test(f.title), source_url: url,
    },
    match: { first: f.first, last: f.last },
    rows: rows ?? [],
  };
}

// ---------- run ----------

async function main() {
  const args = process.argv.slice(2);
  const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const dryRun = args.includes("--dry-run");
  const limit = arg("--limit") ? parseInt(arg("--limit"), 10) : Infinity;
  const chambers = arg("--chamber") ? [arg("--chamber")] : ["house", "senate"];

  const db = getClient();
  const run = async () => {
    const seen = dryRun ? new Set() : new Set((await fetchAll(db, "ptr_filings", "filing_id")).map((f) => f.filing_id));
    const match = memberMatcher(
      await fetchAll(db, "members", "bioguide_id,first_name,middle_name,last_name,nickname"),
      await fetchAll(db, "terms", "bioguide_id,chamber,state,district,start_date,end_date"));
    const thisYear = new Date().getUTCFullYear();
    let filings = 0, trades = 0, scanned = 0, unmatched = [];

    const save = async (read, bioguide) => {
      const rows = read.rows.map((t, i) => ({
        ...t, comment: t.comment ?? null, filing_id: read.filing.filing_id, row_num: i + 1,
        bioguide_id: bioguide, filed_date: read.filing.filed_date,
      }));
      if (dryRun) {
        if (filings < 4) console.log(JSON.stringify({ ...read.filing, bioguide_id: bioguide }), `trades=${rows.length}`, rows[0] ? JSON.stringify(rows[0]) : "");
      } else {
        await upsertBatches(db, "ptr_filings", [{ ...read.filing, bioguide_id: bioguide, transaction_count: rows.length }], "filing_id");
        await upsertBatches(db, "stock_transactions", rows, "filing_id,row_num");
      }
      filings++; trades += rows.length; if (read.filing.format === "scanned") scanned++;
    };

    if (chambers.includes("house")) {
      const years = [];
      for (let y = Math.max(FROM_YEAR, thisYear - 1); y <= thisYear; y++) years.push(y);
      const { list, tmp } = await houseFilings(years, seen, limit);
      console.log(`House: ${list.length} new filings`);
      for (const f of list) {
        const read = await readHouseFiling(f, tmp);
        if (!read) continue;
        const bioguide = match.house(read.match.last, read.match.stateDst, read.filing.filed_date);
        if (!bioguide) { unmatched.push(read.filing.filer_name); continue; } // candidates and others: out of scope
        await save(read, bioguide);
      }
    }
    if (chambers.includes("senate")) {
      const { data } = dryRun ? { data: null } : await db.from("ingest_runs").select("started_at").eq("job", "trades")
        .eq("status", "succeeded").order("started_at", { ascending: false }).limit(1);
      const sinceDate = data?.[0] ? new Date(new Date(data[0].started_at).getTime() - 7 * 86_400_000) : new Date(`${FROM_YEAR}-01-01`);
      const since = `${String(sinceDate.getUTCMonth() + 1).padStart(2, "0")}/${String(sinceDate.getUTCDate()).padStart(2, "0")}/${sinceDate.getUTCFullYear()} 00:00:00`;
      const session = await senateSession();
      const list = await senateFilings(session, since, seen, limit);
      console.log(`Senate: ${list.length} new filings since ${since.slice(0, 10)}`);
      for (const f of list) {
        const read = await readSenateFiling(f, session);
        if (!read) continue;
        const bioguide = match.senate(read.match.first, read.match.last, read.filing.filed_date);
        if (!bioguide) { unmatched.push(read.filing.filer_name); continue; }
        await save(read, bioguide);
      }
    }

    console.log(`saved: ${filings} filings (${scanned} scanned, linked only), ${trades} trades`);
    if (unmatched.length) console.log(`not matched to a current or recent member (skipped): ${unmatched.length}: ${[...new Set(unmatched)].slice(0, 15).join("; ")}`);
    if (dryRun) console.log("dry run: nothing written");
    return { rows_inserted: filings + trades, rows_updated: 0 };
  };

  if (dryRun) await run();
  else await withRun(db, "trades", run);
}

export { memberMatcher, sameSurname };

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
