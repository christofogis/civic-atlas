// Short plain-language summaries of whole bills, written by Claude through Anthropic's Batch API
// (half price; results within hours) from the bill's CRS summary only. Each is one sentence (the
// lead) and, when the bill does several distinct things, up to four short points, in English and
// Spanish. Written once per CRS summary and stored; nothing calls the API when someone views a page.
//
// Same flow as section-summaries.mjs: each run collects any batch a previous run sent, then sends a
// new one, then waits up to --wait minutes. Every summary is checked by a second request against the
// CRS summary; a flagged one is rewritten once with the problems named; flagged twice, it is held
// and never published. Only summaries that pass are published.
//
// Which bills: every bill with a roll-call vote, every bill that became law, and the bills on /week
// (passed a chamber, became law or was vetoed in the last 14 days, or on the House floor schedule),
// newest first; bills without a CRS summary are skipped. Bills already summarized are checked
// every run: if their CRS summary changed (its hash differs), they are summarized again.
//
//   node scripts/ingest/bill-summaries.mjs --limit 100          (new summaries per run, newest first)
//   node scripts/ingest/bill-summaries.mjs --bills 119-hr-1,119-s-5
//   options: --wait 60 (minutes), --dry-run (build requests, print one and a token estimate; send
//            nothing, write nothing), --collect-only, --redo (summarize again after the instructions change)
import { createHash } from "node:crypto";
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { parseCheck } from "./section-summaries.mjs";

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const DRY = args.includes("--dry-run");
const COLLECT_ONLY = args.includes("--collect-only");
const BILLS = arg("--bills")?.split(",").map((s) => s.trim()).filter(Boolean);
const LIMIT = arg("--limit") ? parseInt(arg("--limit"), 10) : 100;
const REDO = args.includes("--redo");
const WAIT_MIN = arg("--wait") ? parseInt(arg("--wait"), 10) : 60;

const MODEL = process.env.SUMMARY_MODEL || "claude-haiku-5-5";
const CHECK_MODEL = process.env.CHECK_MODEL || "claude-haiku-5-5";
const JOB = "bill-summaries";
export const SHORT_CHARS = 250;     // a CRS summary this short gets a lead only, no points
export const MAX_CHARS = 300_000;   // longer CRS summaries are skipped
const MAX_REQUESTS = 20_000;
const WEEK_DAYS = 14;               // /week shows the last week with votes; 14 days covers a recess week
const API = "https://api.anthropic.com/v1/messages/batches";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Batch prices per million tokens, for the estimate printed by --dry-run only (override if they change).
const PRICE_IN = Number(process.env.PRICE_IN_PER_MTOK ?? 0.5);
const PRICE_OUT = Number(process.env.PRICE_OUT_PER_MTOK ?? 2.5);

const KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = (path, init = {}) => fetch(path.startsWith("http") ? path : `${API}${path}`, {
  ...init,
  headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(init.headers ?? {}) },
});

// The same fixed instructions for every bill, so every party's bills are summarized the same way.
export const SYSTEM = `You write a short plain-language summary of a United States federal bill or resolution for a nonpartisan public reference website. Readers are ordinary citizens without legal training. You work only from the official summary written by the Congressional Research Service (CRS). The CRS summary and the official text are one tap away from yours, and yours is labeled as AI-generated.

What to write:
- "lead": one plain sentence of 25 words or fewer that says what the measure does. Start with what it does ("Requires ...", "Sets ...", "Names the post office ...", "Expresses ..."); avoid filler such as "This bill" when you can.
- "points": only when the measure does several distinct things, up to four short lines of 18 words or fewer each, one per main thing it does, in the order of the CRS summary, without repeating the lead. Leave out minor and technical provisions. If it does one thing, give an empty list.
- If the user message says the CRS summary is short, give the lead and an empty points list.
- Say who must, may, or may not do what; what is created, changed, or ended; amounts, dates, and who is covered, as the CRS summary states them.
- If the CRS summary describes a version of the measure (for example, as introduced or as passed by the House), describe what that summary says; don't add what happened to the measure.

Plain language:
- Write at about an 8th-grade reading level, in short sentences.
- No section numbers, U.S. Code citations, or Public Law numbers. Name a law in words ("the Food and Nutrition Act of 2008"), not by citation.
- If you must use a legal term, explain it in a few words.

Neutrality:
- Use only what the CRS summary says. Add no background, history, context, or outside facts, and no descriptive phrases of your own.
- Keep the summary's own actors and groups; don't make a group broader or narrower.
- Use the summary's own figures, dates, and names exactly. Do not round, total, convert, or estimate.
- Never describe purpose, intent, motive, effect, impact, cost, benefit, fairness, or who gains or loses. If the CRS summary reports a stated purpose, you may say "States that its purpose is ...".
- No words that judge or rate, such as significant, major, sweeping, landmark, controversial, harmful, important, modest, strict, generous, loophole, crackdown. A term the measure itself uses (such as "major disaster") is fine.

Spanish:
- Give a faithful Spanish version of the lead and of each point in neutral Latin American Spanish, with the same content and no additions, and the same number of points.
- Keep the official names of laws, programs, and agencies' acts in English as printed.

Reply with JSON only, no other text: {"lead_en": "...", "points_en": ["..."], "lead_es": "...", "points_es": ["..."]}`;

export const CHECK_SYSTEM = `You check an AI-written short summary of a United States federal bill or resolution against the official summary by the Congressional Research Service (CRS), for a nonpartisan public reference website. The AI summary is one sentence (the lead) and up to four short points.

List every problem you find. Look for:
- facts, names, numbers, amounts, or dates that differ from the CRS summary, or that it doesn't contain;
- who does what: a different actor, or a broader or narrower group than the CRS summary names;
- added background, context, or descriptions that are not in the CRS summary;
- leaving something out in a way that changes the meaning: a requirement stated without a condition, limit, or exception that the CRS summary attaches to it, or a lead that makes the measure seem to do something other than its main subject. Leaving out minor or secondary provisions is allowed and is not a problem;
- any statement of purpose, intent, motive, effect, impact, cost, or benefit that the CRS summary does not itself report;
- words that judge or rate (such as significant, sweeping, harmful, important, modest);
- legal citations: section numbers, U.S. Code citations, or Public Law numbers.

A plain-language rewording that keeps the meaning is not a problem.

Then check that the Spanish says the same as the English, with nothing added or missing.

Reply with JSON only, no other text: {"ok": true, "problems": []} or {"ok": false, "problems": ["<the summary's words> — <what the CRS summary says>", ...]}`;

const billLabel = { hr: "H.R.", s: "S.", hjres: "H.J.Res.", sjres: "S.J.Res.", hconres: "H.Con.Res.", sconres: "S.Con.Res.", hres: "H.Res.", sres: "S.Res." };
const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) ? 0 : (n % 10 < 4 ? n % 10 : 0)]}`;

// The hash of the CRS summary exactly as stored in bills.crs_summary. The table's read policy
// computes the same hash in SQL, so a summary of an older CRS text is never shown.
export const sourceHash = (text) => createHash("sha256").update(String(text), "utf8").digest("hex");
export const isShort = (text) => String(text ?? "").length < SHORT_CHARS;

export function userPrompt(bill) {
  const crs = bill.crs_summary;
  return [
    `Measure: ${billLabel[bill.bill_type] ?? bill.bill_type} ${bill.number}, ${ordinal(bill.congress)} Congress — ${bill.short_title || bill.title}`,
    bill.short_title && bill.title && bill.short_title !== bill.title ? `Official title: ${bill.title}` : null,
    isShort(crs) ? "The CRS summary is short: give the lead and an empty points list." : null,
    "",
    "CRS summary:",
    crs,
  ].filter((x) => x != null).join("\n");
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;
const cleanPoint = (p) => String(p ?? "").replace(/^\s*[-•*]\s*/, "").trim();

// The model's reply -> {lead_en, lead_es, points_en, points_es}, or null if it isn't what was asked.
export function parseReply(text, { short = false } = {}) {
  const m = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const lead_en = typeof j.lead_en === "string" ? j.lead_en.trim() : "";
  const lead_es = typeof j.lead_es === "string" ? j.lead_es.trim() : "";
  if (!lead_en || !lead_es) return null;
  if (words(lead_en) > 40) return null;          // far past the 25-word limit: not the one sentence asked for
  let points_en = Array.isArray(j.points_en) ? j.points_en.map(cleanPoint).filter(Boolean) : [];
  let points_es = Array.isArray(j.points_es) ? j.points_es.map(cleanPoint).filter(Boolean) : [];
  if (points_en.length !== points_es.length) return null;
  if (short) { points_en = []; points_es = []; }
  return { lead_en, lead_es, points_en: points_en.slice(0, 4), points_es: points_es.slice(0, 4) };
}

const asText = (s, lang) => [s[`lead_${lang}`], ...(s[`points_${lang}`] ?? []).map((p) => `- ${p}`)].join("\n");

export function checkPrompt(bill, summary) {
  return `${userPrompt(bill)}\n\nAI summary (English):\n${asText(summary, "en")}\n\nAI summary (Spanish):\n${asText(summary, "es")}`;
}

export function rewritePrompt(bill, problems) {
  return `${userPrompt(bill)}\n\nA reviewer found these problems in an earlier summary of this measure. Write a new summary that avoids them:\n${problems.map((p) => `- ${p}`).join("\n")}`;
}

export const billKey = (b) => `${b.congress}|${b.bill_type}|${b.number}`;
const maxDate = (...ds) => ds.filter(Boolean).map((d) => String(d).slice(0, 10)).sort().at(-1) ?? "";

// Which bills are in scope, newest first. votes: {bill_congress,bill_type,bill_number,voted_at};
// bills: metadata rows (no text); events: upcoming_events rows {bill_refs, event_date};
// storedKeys: bills that already have a summary (kept in scope so a changed CRS summary is redone).
export function candidateKeys({ votes = [], bills = [], events = [], storedKeys = [], today }) {
  const since = new Date(new Date(`${today}T00:00:00Z`).getTime() - WEEK_DAYS * 864e5).toISOString().slice(0, 10);
  const recent = new Map();   // key -> newest date that puts it in scope
  const touch = (k, d) => { if (!recent.has(k) || (d ?? "") > recent.get(k)) recent.set(k, d ?? ""); };
  for (const v of votes) if (v.bill_type) touch(`${v.bill_congress}|${v.bill_type}|${v.bill_number}`, String(v.voted_at ?? "").slice(0, 10));
  for (const b of bills) {
    const k = billKey(b);
    if (b.law_number || b.became_law_date) touch(k, maxDate(b.became_law_date, b.latest_action_date));
    const moved = maxDate(b.passed_house_date, b.passed_senate_date, b.became_law_date, b.vetoed_date);
    if (moved && moved >= since) touch(k, moved);
  }
  for (const e of events) {
    if (!e.event_date || e.event_date < since) continue;
    for (const ref of e.bill_refs ?? []) {
      const [c, t, n] = String(ref).split("-");
      if (c && t && n) touch(`${parseInt(c, 10)}|${t}|${parseInt(n, 10)}`, e.event_date);
    }
  }
  const meta = new Map(bills.map((b) => [billKey(b), b]));
  for (const k of storedKeys) if (!recent.has(k)) touch(k, meta.get(k)?.latest_action_date ?? "");
  return [...recent.entries()].sort((a, z) => z[1].localeCompare(a[1]) || z[0].localeCompare(a[0])).map(([k]) => k);
}

// What to send for each candidate bill (in order). bills: Map key -> {.., crs_summary};
// stored: Map key -> row; inFlight: Set of keys in an uncollected batch.
// New summaries (no row yet, or --redo) are limited to `limit`; a changed CRS summary is always
// redone (few a day, and the old summary is already hidden by the read policy); checks and
// rewrites of stored rows always go.
export function planWork({ keys, bills, stored, inFlight = new Set(), limit = Infinity, redo = false, newSummaries = true }) {
  const plan = { summarize: [], check: [], rewrite: [], skipped: { noSummary: 0, tooLong: 0 } };
  let fresh = 0;
  for (const k of keys) {
    if (inFlight.has(k)) continue;
    const bill = bills.get(k);
    if (!bill?.crs_summary) { plan.skipped.noSummary++; continue; }
    if (bill.crs_summary.length > MAX_CHARS) { plan.skipped.tooLong++; continue; }
    const hash = sourceHash(bill.crs_summary);
    const row = stored.get(k);
    if (row && row.source_hash !== hash) { if (newSummaries) plan.summarize.push({ bill, hash, reason: "changed" }); continue; }
    if (row && !redo) {
      if (row.status === "unchecked") plan.check.push({ bill, hash, row });
      else if (row.status === "flagged") plan.rewrite.push({ bill, hash, row });
      continue;
    }
    if (!newSummaries || fresh >= limit) continue;
    plan.summarize.push({ bill, hash, reason: row ? "redo" : "new" });
    fresh++;
  }
  return plan;
}

const KEYS = ["congress", "bill_type", "number"];
const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));

async function mapLimit(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// Collect every finished batch. Items carry a kind: s (summary), r (rewrite), c (check).
async function collect(db) {
  const { data: open, error } = await db.from("ai_batches").select("id,model,items,created_at").eq("job", JOB).eq("status", "sent");
  if (error) throw new Error(`read ai_batches: ${error.message}`);
  const t = { written: 0, passed: 0, flagged: 0, held: 0, failed: 0, pending: 0 };
  for (const b of open) {
    const res = await anthropic(`/${b.id}`);
    if (!res.ok) throw new Error(`batch ${b.id}: HTTP ${res.status}`);
    const info = await res.json();
    if (info.processing_status !== "ended") { t.pending++; console.log(`batch ${b.id}: ${info.processing_status}`, info.request_counts); continue; }
    const out = await anthropic(info.results_url);
    if (!out.ok) throw new Error(`batch ${b.id} results: HTTP ${out.status}`);
    const summaries = [], checks = [];
    let bad = 0, inTok = 0, outTok = 0;
    for (const line of (await out.text()).split("\n")) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const item = b.items[r.custom_id];
      if (!item) continue;
      if (r.result?.type !== "succeeded") { bad++; console.log(`${r.custom_id}: ${r.result?.type} ${r.result?.error?.type ?? ""}`); continue; }
      const msg = r.result.message;
      inTok += msg.usage?.input_tokens ?? 0; outTok += msg.usage?.output_tokens ?? 0;
      const raw = msg.content?.find((c) => c.type === "text")?.text ?? "";
      const parsed = item.kind === "c" ? parseCheck(raw) : parseReply(raw, { short: item.short });
      if (!parsed) {
        bad++;
        console.log(`${r.custom_id}: reply was not the expected JSON (stop: ${msg.stop_reason}, ${msg.usage?.output_tokens} tokens; ${item.bill_type}${item.number})`);
        console.log(`  starts ${JSON.stringify(raw.replace(/\s+/g, " ").slice(0, 300))}`);
        continue;
      }
      if (item.kind === "c") checks.push({ item, ...parsed });
      else summaries.push({ ...pick(item, KEYS), source: "crs", source_hash: item.source_hash, source_chars: item.source_chars,
        ...parsed, model: b.model, batch_id: b.id, published: false, status: "unchecked", attempts: item.attempts ?? 1,
        check_notes: item.kind === "r" ? item.problems : null, check_model: null });
    }
    if (!DRY) {
      await upsertBatches(db, "bill_plain_summaries", summaries, KEYS.join(","), 200);
      await mapLimit(checks, 8, async ({ item, ok, problems }) => {
        const status = ok ? "passed" : (item.attempts ?? 1) >= 2 ? "held" : "flagged";
        // Published only when it passes the check, never otherwise (DB constraint too).
        let q = db.from("bill_plain_summaries").update({ status, published: status === "passed", check_notes: problems.length ? problems : null, check_model: b.model });
        for (const k of KEYS) q = q.eq(k, item[k]);
        // Only if the summary checked is still the one stored (a redo may have replaced it).
        const { error: e } = await q.eq("attempts", item.attempts ?? 1).eq("batch_id", item.summary_batch).eq("source_hash", item.source_hash);
        if (e) throw new Error(`update check: ${e.message}`);
        t[status]++;
      });
    }
    const counts = { written: summaries.length, checked: checks.length, failed: bad, input_tokens: inTok, output_tokens: outTok };
    await db.from("ai_batches").update({ status: "collected", collected_at: new Date().toISOString(), counts }).eq("id", b.id);
    console.log(`batch ${b.id}: collected`, counts);
    t.written += summaries.length; t.failed += bad;
  }
  return t;
}

// Bill rows with their CRS summary, for a list of keys, a few dozen per request.
async function billsWithText(db, keys) {
  const out = new Map();
  const cols = "congress,bill_type,number,title,short_title,crs_summary";
  for (let i = 0; i < keys.length; i += 60) {
    const groups = new Map();
    for (const k of keys.slice(i, i + 60)) {
      const [c, t, n] = k.split("|");
      groups.set(`${c}|${t}`, [...(groups.get(`${c}|${t}`) ?? []), n]);
    }
    const or = [...groups.entries()].map(([g, ns]) => { const [c, t] = g.split("|"); return `and(congress.eq.${c},bill_type.eq.${t},number.in.(${ns.join(",")}))`; }).join(",");
    const { data, error } = await db.from("bills").select(cols).or(or);
    if (error) throw new Error(`read bills: ${error.message}`);
    for (const b of data) out.set(billKey(b), b);
  }
  return out;
}

async function send(db, { newSummaries }) {
  const stored = new Map((await fetchAll(db, "bill_plain_summaries", "congress,bill_type,number,source_hash,status,attempts,check_notes,lead_en,lead_es,points_en,points_es,batch_id"))
    .map((r) => [billKey(r), r]));
  let keys;
  if (BILLS) {
    keys = BILLS.map((s) => { const [c, t, n] = s.split("-"); return `${parseInt(c, 10)}|${t.toLowerCase()}|${parseInt(n, 10)}`; });
  } else {
    const today = new Date().toISOString().slice(0, 10);
    const [votes, meta, events] = await Promise.all([
      fetchAll(db, "votes", "bill_congress,bill_type,bill_number,voted_at"),
      fetchAll(db, "bills", "congress,bill_type,number,law_number,became_law_date,passed_house_date,passed_senate_date,vetoed_date,latest_action_date"),
      fetchAll(db, "upcoming_events", "event_date,bill_refs"),
    ]);
    keys = candidateKeys({ votes, bills: meta, events, storedKeys: [...stored.keys()], today });
  }
  const inFlight = new Set();
  const { data: open } = await db.from("ai_batches").select("items").eq("job", JOB).eq("status", "sent");
  for (const b of open ?? []) for (const it of Object.values(b.items)) inFlight.add(billKey(it));

  const bills = await billsWithText(db, keys);
  const plan = planWork({ keys, bills, stored, inFlight, limit: BILLS ? Infinity : LIMIT, redo: REDO, newSummaries });
  const requests = [], items = {};
  const add = (kind, item, params) => { const id = `${kind}${requests.length}`; items[id] = { kind, ...item }; requests.push({ custom_id: id, params }); };
  // Haiku 5.5 thinks by default and its (hidden) thinking counts toward max_tokens: low effort keeps
  // it short, and the limit leaves room for thinking plus both languages.
  const summaryParams = (content) => ({ model: MODEL, max_tokens: 8000, output_config: { effort: "low" }, system: SYSTEM, messages: [{ role: "user", content }] });
  const checkParams = (content) => ({ model: CHECK_MODEL, max_tokens: 8000, system: CHECK_SYSTEM, messages: [{ role: "user", content }] });
  const base = ({ bill, hash }) => ({ ...pick(bill, KEYS), source_hash: hash, source_chars: bill.crs_summary.length, short: isShort(bill.crs_summary) });

  let chars = 0;
  for (const w of plan.summarize) { if (requests.length >= MAX_REQUESTS) break; add("s", { ...base(w), attempts: 1 }, summaryParams(userPrompt(w.bill))); chars += w.bill.crs_summary.length; }
  for (const w of plan.check) {
    if (requests.length >= MAX_REQUESTS) break;
    add("c", { ...base(w), attempts: w.row.attempts, summary_batch: w.row.batch_id }, checkParams(checkPrompt(w.bill, w.row)));
  }
  for (const w of plan.rewrite) {
    if (requests.length >= MAX_REQUESTS) break;
    const problems = w.row.check_notes ?? [];
    add("r", { ...base(w), attempts: (w.row.attempts ?? 1) + 1, problems }, summaryParams(rewritePrompt(w.bill, problems)));
  }
  const reasons = plan.summarize.reduce((a, w) => ({ ...a, [w.reason]: (a[w.reason] ?? 0) + 1 }), {});
  console.log(`${keys.length} bills in scope; ${requests.length} requests: ${plan.summarize.length} summaries ${JSON.stringify(reasons)}, ${plan.check.length} checks, ${plan.rewrite.length} rewrites; ` +
    `${plan.skipped.noSummary} without a CRS summary (left as they are), ${plan.skipped.tooLong} too long`);
  if (!requests.length) return { sent: 0 };
  if (DRY) {
    // Rough estimate: ~4 characters per token; output (with low-effort thinking) and the check pass
    // sized from the section-summary batches (Nov 26, 2026), plus a rewrite and second check for ~25%.
    const n = plan.summarize.length;
    const inTok = Math.round((n * (SYSTEM.length + CHECK_SYSTEM.length + 500) + 2 * chars) / 4 * 1.25);
    const outTok = Math.round(n * (800 + 900) * 1.25);
    console.log(`estimate for ${n} new summaries with their checks: ~${(inTok / 1e6).toFixed(2)}M input, ~${(outTok / 1e6).toFixed(2)}M output tokens; ` +
      `~$${((inTok * PRICE_IN + outTok * PRICE_OUT) / 1e6).toFixed(2)} at $${PRICE_IN}/$${PRICE_OUT} per million (batch)`);
    console.log("dry run: first request:\n" + JSON.stringify(requests[0], null, 2).slice(0, 4000));
    return { sent: 0 };
  }

  const res = await anthropic("", { method: "POST", body: JSON.stringify({ requests }) });
  if (!res.ok) throw new Error(`send batch: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const batch = await res.json();
  const { error } = await db.from("ai_batches").insert({ id: batch.id, job: JOB, model: MODEL, items });
  if (error) throw new Error(`record batch ${batch.id}: ${error.message}`);
  console.log(`sent batch ${batch.id} with ${requests.length} requests`);
  return { sent: requests.length };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  if (!KEY && !DRY) throw new Error("ANTHROPIC_API_KEY must be set");
  const db = getClient();
  const work = async () => {
    const until = Date.now() + WAIT_MIN * 60_000;
    const total = { written: 0, passed: 0, flagged: 0, held: 0, failed: 0 };
    let first = true;
    for (;;) {
      // A dry run reads only: it doesn't collect (that writes) or call the API.
      const c = DRY ? { pending: 0 } : await collect(db);
      for (const k of Object.keys(total)) total[k] += c[k] ?? 0;
      const s = COLLECT_ONLY || c.pending ? { sent: 0 } : await send(db, { newSummaries: first });
      if (!COLLECT_ONLY && !c.pending) first = false;
      if (DRY || (!s.sent && !c.pending)) break;
      if (Date.now() > until) { console.log("wait over; a later run collects what is pending"); break; }
      await sleep(60_000);
    }
    console.log("done", total);
    return { rows_inserted: total.written, rows_updated: total.passed + total.flagged + total.held };
  };
  if (DRY) await work();
  else await withRun(db, JOB, work);
}
