// Weekly accuracy check: pick random facts from the database and compare each with the
// original source. Writes the result to accuracy_checks (public) and exits non-zero on any
// mismatch, which opens a GitHub issue.
//   node scripts/checks/accuracy.mjs [--dry-run]
import { XMLParser } from "fast-xml-parser";
import { getClient } from "../ingest/lib.mjs";

const DRY = process.argv.includes("--dry-run");
const N = 5;   // facts per area
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });
const UA = { headers: { "User-Agent": "civic-atlas accuracy check (github.com/christofogis/civic-atlas)" } };
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v) => String(typeof v === "object" ? v?.["#text"] ?? "" : v ?? "").trim();
const db = getClient();
const results = [];
const record = (area, fact, ours, source, url) =>
  results.push({ area, fact, ours: String(ours), source: String(source), ok: String(ours) === String(source), url });


// Roll-call positions.
for (const chamber of ["house", "senate"]) {
  // Random votes across the whole record, then a random member's position on each.
  const { data: votes, error } = await db.from("votes").select("vote_id").eq("chamber", chamber).limit(5000);
  if (error) throw error;
  const picks = [];
  for (const v of votes.sort(() => Math.random() - 0.5).slice(0, N)) {
    const { data: ps } = await db.from("vote_position_details").select("vote_id,bioguide_id,position").eq("vote_id", v.vote_id);
    picks.push(ps[Math.floor(Math.random() * ps.length)]);
  }
  for (const p of picks) {
    const { data: v } = await db.from("votes").select("source_url").eq("vote_id", p.vote_id).single();
    const doc = parser.parse(await (await fetch(v.source_url, UA)).text());
    let source = "(not found)";
    if (chamber === "house") {
      const rec = list(doc["rollcall-vote"]?.["vote-data"]?.["recorded-vote"]).find((r) => r.legislator?.["@_name-id"] === p.bioguide_id);
      if (rec) source = text(rec.vote);
    } else {
      const { data: m } = await db.from("members").select("lis_id").eq("bioguide_id", p.bioguide_id).single();
      const rec = list(doc.roll_call_vote?.members?.member).find((x) => text(x.lis_member_id) === m?.lis_id);
      if (rec) source = text(rec.vote_cast);
    }
    record(`${chamber === "house" ? "House" : "Senate"} vote`, `${p.bioguide_id} on ${p.vote_id}`, p.position, source, v.source_url);
  }
}

// Bills: sponsor, introduced date, active cosponsors, law number.
{
  // Half random bills, half bills that became law (so law numbers get checked too).
  const total = (await db.from("bills").select("*", { count: "exact", head: true })).count;
  const rows = [];
  for (let i = 0; i < N; i++) {
    const q = db.from("bills").select("congress,bill_type,number,sponsor_bioguide_id,introduced_date,law_number");
    const { data } = i % 2 ? await q.not("law_number", "is", null).range(Math.floor(Math.random() * 300), Math.floor(Math.random() * 300))
      : await q.range(Math.floor(Math.random() * total), Math.floor(Math.random() * total));
    if (data?.[0]) rows.push(data[0]);
  }
  for (const b of rows) {
    const url = `https://www.govinfo.gov/bulkdata/BILLSTATUS/${b.congress}/${b.bill_type}/BILLSTATUS-${b.congress}${b.bill_type}${b.number}.xml`;
    const s = parser.parse(await (await fetch(url, UA)).text())?.billStatus?.bill ?? {};
    const { count } = await db.from("bill_cosponsors").select("*", { count: "exact", head: true })
      .eq("congress", b.congress).eq("bill_type", b.bill_type).eq("number", b.number).is("withdrawn_date", null);
    const cos = list(s.cosponsors?.item);
    const active = new Set(cos.filter((c) => !c.sponsorshipWithdrawnDate).map((c) => c.bioguideId));
    const law = list(s.laws?.item)[0];
    const id = `${b.bill_type}${b.number} (${b.congress})`;
    record("Bill sponsor", id, b.sponsor_bioguide_id ?? "", text(list(s.sponsors?.item)[0]?.bioguideId), url);
    record("Bill introduced", id, b.introduced_date, text(s.introducedDate), url);
    record("Bill cosponsors", id, count, active.size, url);
    record("Bill law number", id, b.law_number ?? "", law ? `${text(law.type) || "Public Law"} ${text(law.number)}` : "", url);
  }
}

// Campaign finance: receipts for the cycle, from OpenFEC.
if (process.env.DATA_GOV_API_KEY) {
  const { data: rows } = await db.from("finance_summaries").select("fec_candidate_id,cycle,receipts").eq("cycle", 2026).limit(1000);
  for (const f of rows.sort(() => Math.random() - 0.5).slice(0, N)) {
    const url = `https://api.open.fec.gov/v1/candidate/${f.fec_candidate_id}/totals/?cycle=${f.cycle}&election_full=false`;
    const res = await fetch(url, { headers: { "X-Api-Key": process.env.DATA_GOV_API_KEY } });
    const t = (await res.json())?.results?.find((r) => r.cycle === f.cycle);
    record("Campaign receipts", `${f.fec_candidate_id} ${f.cycle}`, Number(f.receipts).toFixed(2), t ? Number(t.receipts).toFixed(2) : "(not found)",
      `https://www.fec.gov/data/candidate/${f.fec_candidate_id}/?cycle=${f.cycle}`);
  }
}

const matched = results.filter((r) => r.ok).length;
for (const r of results) console.log(`${r.ok ? "ok  " : "DIFF"} ${r.area}: ${r.fact} — ours ${r.ours}, source ${r.source}`);
console.log(`\n${matched} of ${results.length} matched`);
if (!DRY) {
  const { error } = await db.from("accuracy_checks").insert({ checked: results.length, matched, details: results });
  if (error) throw error;
}
if (matched < results.length) process.exit(1);
