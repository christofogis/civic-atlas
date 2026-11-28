// The simpler version of a bill's AI summary ("Explain it simply" / "Explícalo fácil"): two or three
// short sentences in everyday words, about a 5th-grade reading level, in English and Spanish, written
// by Claude through Anthropic's Batch API from the bill's CRS summary only (the same source and hash
// as the plain summary). Stored in bill_simple_summaries; nothing calls the API on a page view.
//
// A separate job and table from bill-summaries.mjs, so the published plain summaries are never
// rewritten or hidden by this one, and its batches are collected on their own. Same flow: each run
// collects any batch a previous run sent, then sends a new one, then waits up to --wait minutes.
// Every version is checked by a second request against the CRS summary; a flagged one is rewritten
// once with the problems named; flagged twice, it is held and never published.
//
// Which bills: only bills whose plain summary is published and still matches the current CRS summary
// (the site shows the simple version only inside that summary). The quiz's bills first (the same
// fixed rule as /quiz, src/lib/quizPick.js), then the rest, newest action first. A bill whose CRS
// summary changed is written again.
//
//   node scripts/ingest/bill-simple-summaries.mjs --limit 100
//   node scripts/ingest/bill-simple-summaries.mjs --bills 119-hr-1,119-s-5
//   options: --wait 60 (minutes), --dry-run (build requests, print one and a cost estimate; send
//            nothing, write nothing), --collect-only, --redo (write again after the instructions change)
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { parseCheck } from "./section-summaries.mjs";
import { userPrompt, sourceHash, billKey, billsWithText, MAX_CHARS } from "./bill-summaries.mjs";
import { quizCandidates } from "../../src/lib/quizPick.js";
import { congressOn } from "../../lib/congress.js";

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
const JOB = "bill-simple-summaries";
const TABLE = "bill_simple_summaries";
const MAX_REQUESTS = 20_000;
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

// The same fixed instructions for every bill, so every party's bills are explained the same way.
export const SIMPLE_SYSTEM = `You write a very simple explanation of a United States federal bill or resolution for a nonpartisan public reference website. Readers include young people and adults who find legal and government language hard to read. You work only from the official summary written by the Congressional Research Service (CRS). A longer summary, the CRS summary and the official text are one tap away from yours, and yours is labeled as AI-generated.

What to write:
- Two or three short sentences that say what the measure does. Each sentence has about 15 words or fewer.
- If the user message says the CRS summary is short, one or two sentences.
- Say the main things the measure does, in the order of the CRS summary. Leave out minor and technical details.
- Say who must, may, or may not do what, as the CRS summary states it. Keep "must" and "may" as the CRS summary has them.
- If the CRS summary describes a version of the measure (for example, as introduced or as passed by the House), describe what that summary says; don't add what happened to the measure.

Simple words:
- Write at about a 5th-grade reading level: short, common words and short sentences.
- No jargon and no legal terms. Say what a term means in everyday words instead of using it. The names of agencies, programs, and laws are fine.
- No section numbers, U.S. Code citations, or Public Law numbers.
- No analogies, comparisons, metaphors, or examples. Don't say what the measure is "like", and don't compare it with anything else.

Neutrality:
- Use only what the CRS summary says. Add no background, history, context, or outside facts.
- Keep the summary's own actors and groups; don't make a group broader or narrower.
- When the CRS summary lists several items of the same kind (such as the bills a rule provides for, or a list of programs), name them all or none of them; never single some out or describe only some of them.
- A measure's official title, or the title of a bill a rule provides for, may state a purpose or a claim (such as "to ensure access to affordable health insurance" or "that will break the gridlock"). Never use such title wording as your own description: say what the measure does or amends, or give the title in quotation marks as its title.
- Use the summary's own figures, dates, and names exactly. Do not round, total, convert, or estimate.
- Never describe purpose, intent, motive, effect, impact, cost, benefit, fairness, or who gains or loses. If the CRS summary reports a stated purpose, you may say "It says its purpose is ...".
- No words that judge or rate, such as significant, major, big, important, good, bad, harmful, helpful, strict, generous, fair, unfair. A term the measure itself uses (such as "major disaster") is fine.

Spanish:
- Give a faithful Spanish version in simple, neutral Latin American Spanish, with the same content, the same number of sentences, and no additions.
- Keep the official names of laws and programs in English as printed.

Reply with JSON only, no other text: {"text_en": "...", "text_es": "..."}`;

export const SIMPLE_CHECK_SYSTEM = `You check an AI-written very simple explanation (two or three short sentences) of a United States federal bill or resolution against the official summary by the Congressional Research Service (CRS), for a nonpartisan public reference website.

The explanation is meant to be simpler than the CRS summary, so it may leave out minor details and use everyday words. That alone is not a problem. But every statement it makes must be true to the CRS summary.

List every problem you find. Look for:
- any statement that is not true to the CRS summary: facts, names, numbers, amounts, or dates that differ from it or that it doesn't contain;
- who does what: a different actor, or a broader or narrower group than the CRS summary names;
- singling out: when the CRS summary lists several items of the same kind (such as the bills a rule provides for), naming or describing only some of them;
- title wording that states a purpose or claim (such as "to ensure access to affordable health insurance") used as the summary's own description instead of being quoted as a title;
- "must" where the CRS summary says "may", or "may" where it says "must";
- a statement that leaves out a condition, limit, or exception so that the statement itself becomes untrue, or an explanation whose main subject is not the measure's main subject;
- anything added: background, context, outside facts, or descriptions not in the CRS summary;
- any analogy, comparison, metaphor, or example (such as saying the measure is "like" something);
- any statement of purpose, intent, motive, effect, impact, cost, or benefit that the CRS summary does not itself report;
- words that judge or rate (such as significant, big, important, good, harmful, fair);
- legal citations: section numbers, U.S. Code citations, or Public Law numbers.

Then check that the Spanish says the same as the English, with nothing added or missing.

Reply with JSON only, no other text: {"ok": true, "problems": []} or {"ok": false, "problems": ["<the explanation's words> — <what the CRS summary says>", ...]}`;

const words = (s) => s.split(/\s+/).filter(Boolean).length;
// Sentences: split after ., ! or ? and a space before a capital, but not after initials such as
// "U.S." or "D.C." or a title such as "Dr.".
const ABBR = /(?<!(?:^|[\s(])\p{Lu}\.(?:\p{Lu}\.)+)(?<!(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Sr|Jr|No|Sec|Gen|Sen|Rep)\.)/u.source;
const SPLIT = new RegExp(`(?<=[.!?])${ABBR}\\s+(?=[\\p{Lu}¿¡"“])`, "u");
export const sentences = (s) => String(s ?? "").trim().split(SPLIT).filter((x) => x.trim()).length;

// The model's reply -> {text_en, text_es}, or null if it isn't what was asked: both languages,
// at most four sentences and 75 words each (asked for two or three short sentences).
export function parseSimple(text) {
  const m = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  let j;
  try { j = JSON.parse(m[0]); } catch { return null; }
  const clean = (x) => (typeof x === "string" ? x.replace(/\s+/g, " ").trim() : "");
  const text_en = clean(j.text_en), text_es = clean(j.text_es);
  if (!text_en || !text_es) return null;
  for (const t of [text_en, text_es]) if (sentences(t) > 4 || words(t) > 75) return null;
  return { text_en, text_es };
}

export function simpleCheckPrompt(bill, s) {
  return `${userPrompt(bill)}\n\nAI explanation (English):\n${s.text_en}\n\nAI explanation (Spanish):\n${s.text_es}`;
}

export function simpleRewritePrompt(bill, problems) {
  return `${userPrompt(bill)}\n\nA reviewer found these problems in an earlier explanation of this measure. Write a new one that avoids them:\n${problems.map((p) => `- ${p}`).join("\n")}`;
}

// Which bills, in order: the quiz's bills first, then every other bill with a published plain
// summary, newest action first. quiz: keys from quizCandidates; plain: Map key -> published plain row
// {source_hash}; meta: Map key -> {latest_action_date}.
export function simpleOrder({ quiz = [], plain, meta = new Map() }) {
  const out = [], seen = new Set();
  for (const k of quiz) if (plain.has(k) && !seen.has(k)) { out.push(k); seen.add(k); }
  const rest = [...plain.keys()].filter((k) => !seen.has(k))
    .sort((a, z) => String(meta.get(z)?.latest_action_date ?? "").localeCompare(String(meta.get(a)?.latest_action_date ?? "")) || z.localeCompare(a));
  return [...out, ...rest];
}

// What to send for each bill (in order). bills: Map key -> {.., crs_summary}; plain: Map key ->
// published plain row; stored: Map key -> simple row; inFlight: Set of keys in an uncollected batch.
// Only bills whose plain summary is published and written from the current CRS summary. New ones
// (no row, or --redo) are limited to `limit`; a changed CRS summary is always redone; checks and
// rewrites of stored rows always go.
export function planSimple({ keys, bills, plain, stored, inFlight = new Set(), limit = Infinity, redo = false, newSummaries = true }) {
  const plan = { summarize: [], check: [], rewrite: [], skipped: { noPlain: 0, plainOutdated: 0, tooLong: 0 } };
  let fresh = 0;
  for (const k of keys) {
    if (inFlight.has(k)) continue;
    const bill = bills.get(k);
    const p = plain.get(k);
    if (!p || !bill?.crs_summary) { plan.skipped.noPlain++; continue; }
    if (bill.crs_summary.length > MAX_CHARS) { plan.skipped.tooLong++; continue; }
    const hash = sourceHash(bill.crs_summary);
    if (p.source_hash !== hash) { plan.skipped.plainOutdated++; continue; }   // its plain summary is redone first
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

// Low effort on both requests keeps Haiku's hidden thinking (which counts toward max_tokens) short.
export const simpleParams = (content) => ({ model: MODEL, max_tokens: 6000, output_config: { effort: "low" }, system: SIMPLE_SYSTEM, messages: [{ role: "user", content }] });
export const simpleCheckParams = (content) => ({ model: CHECK_MODEL, max_tokens: 6000, output_config: { effort: "low" }, system: SIMPLE_CHECK_SYSTEM, messages: [{ role: "user", content }] });

// Rough cost of n new versions with their checks, sized from the plain-summary batches of Nov 27,
// 2026 (~1,600 input and ~2,450 output tokens per summary request, ~1,350 and ~970 per check, with
// thinking); this output is shorter and both requests use low effort, so ~1,800 and ~700 output.
// Plus ~25% for a rewrite and a second check.
export function estimate(n, crsChars) {
  const inTok = Math.round((n * (SIMPLE_SYSTEM.length + SIMPLE_CHECK_SYSTEM.length + 600) + 2 * crsChars) / 4 * 1.25);
  const outTok = Math.round(n * (1800 + 700) * 1.25);
  return { inTok, outTok, usd: (inTok * PRICE_IN + outTok * PRICE_OUT) / 1e6 };
}

const KEYS = ["congress", "bill_type", "number"];
const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));

async function mapLimit(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

// Collect every finished batch. Items carry a kind: s (simple version), r (rewrite), c (check).
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
    const rows = [], checks = [];
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
      const parsed = item.kind === "c" ? parseCheck(raw) : parseSimple(raw);
      if (!parsed) {
        bad++;
        console.log(`${r.custom_id}: reply was not the expected JSON (stop: ${msg.stop_reason}, ${msg.usage?.output_tokens} tokens; ${item.bill_type}${item.number})`);
        console.log(`  starts ${JSON.stringify(raw.replace(/\s+/g, " ").slice(0, 300))}`);
        continue;
      }
      if (item.kind === "c") checks.push({ item, ...parsed });
      else rows.push({ ...pick(item, KEYS), source: "crs", source_hash: item.source_hash, source_chars: item.source_chars,
        ...parsed, model: b.model, batch_id: b.id, published: false, status: "unchecked", attempts: item.attempts ?? 1,
        check_notes: item.kind === "r" ? item.problems : null, check_model: null });
    }
    if (!DRY) {
      await upsertBatches(db, TABLE, rows, KEYS.join(","), 200);
      await mapLimit(checks, 8, async ({ item, ok, problems }) => {
        const status = ok ? "passed" : (item.attempts ?? 1) >= 2 ? "held" : "flagged";
        // Published only when it passes the check, never otherwise (DB constraint too).
        let q = db.from(TABLE).update({ status, published: status === "passed", check_notes: problems.length ? problems : null, check_model: b.model });
        for (const k of KEYS) q = q.eq(k, item[k]);
        // Only if the version checked is still the one stored (a redo may have replaced it).
        const { error: e } = await q.eq("attempts", item.attempts ?? 1).eq("batch_id", item.summary_batch).eq("source_hash", item.source_hash);
        if (e) throw new Error(`update check: ${e.message}`);
        t[status]++;
      });
    }
    const counts = { written: rows.length, checked: checks.length, failed: bad, input_tokens: inTok, output_tokens: outTok };
    await db.from("ai_batches").update({ status: "collected", collected_at: new Date().toISOString(), counts }).eq("id", b.id);
    console.log(`batch ${b.id}: collected`, counts);
    t.written += rows.length; t.failed += bad;
  }
  return t;
}

async function send(db, { newSummaries }) {
  const stored = new Map((await fetchAll(db, TABLE, "congress,bill_type,number,source_hash,status,attempts,check_notes,text_en,text_es,batch_id"))
    .map((r) => [billKey(r), r]));
  const plain = new Map((await fetchAll(db, "bill_plain_summaries", "congress,bill_type,number,source_hash,published"))
    .filter((r) => r.published).map((r) => [billKey(r), r]));
  let keys;
  if (BILLS) {
    keys = BILLS.map((s) => { const [c, t, n] = s.split("-"); return `${parseInt(c, 10)}|${t.toLowerCase()}|${parseInt(n, 10)}`; });
  } else {
    // The quiz's rule: the current Congress's newest roll calls on bills (the page reads 1,000).
    const { data: votes, error } = await db.from("votes")
      .select("vote_id,chamber,voted_at,question,description,result,yea_total,nay_total,bill_congress,bill_type,bill_number")
      .eq("congress", congressOn()).not("bill_type", "is", null).order("voted_at", { ascending: false }).limit(1000);
    if (error) throw new Error(`read votes: ${error.message}`);
    const quiz = quizCandidates(votes).map((c) => { const [cg, t, n] = c.key.split("-"); return `${cg}|${t}|${n}`; });
    const meta = new Map((await fetchAll(db, "bills", "congress,bill_type,number,latest_action_date")).map((b) => [billKey(b), b]));
    keys = simpleOrder({ quiz, plain, meta });
    console.log(`${quiz.filter((k) => plain.has(k)).length} of ${quiz.length} quiz candidates have a published plain summary (done first)`);
  }
  const inFlight = new Set();
  const { data: open } = await db.from("ai_batches").select("items").eq("job", JOB).eq("status", "sent");
  for (const b of open ?? []) for (const it of Object.values(b.items)) inFlight.add(billKey(it));

  const bills = await billsWithText(db, keys);
  const plan = planSimple({ keys, bills, plain, stored, inFlight, limit: BILLS ? Infinity : LIMIT, redo: REDO, newSummaries });
  const requests = [], items = {};
  const add = (kind, item, params) => { const id = `${kind}${requests.length}`; items[id] = { kind, ...item }; requests.push({ custom_id: id, params }); };
  const base = ({ bill, hash }) => ({ ...pick(bill, KEYS), source_hash: hash, source_chars: bill.crs_summary.length });

  let chars = 0;
  for (const w of plan.summarize) { if (requests.length >= MAX_REQUESTS) break; add("s", { ...base(w), attempts: 1 }, simpleParams(userPrompt(w.bill))); chars += w.bill.crs_summary.length; }
  for (const w of plan.check) {
    if (requests.length >= MAX_REQUESTS) break;
    add("c", { ...base(w), attempts: w.row.attempts, summary_batch: w.row.batch_id }, simpleCheckParams(simpleCheckPrompt(w.bill, w.row)));
  }
  for (const w of plan.rewrite) {
    if (requests.length >= MAX_REQUESTS) break;
    const problems = w.row.check_notes ?? [];
    add("r", { ...base(w), attempts: (w.row.attempts ?? 1) + 1, problems }, simpleParams(simpleRewritePrompt(w.bill, problems)));
  }
  const reasons = plan.summarize.reduce((a, w) => ({ ...a, [w.reason]: (a[w.reason] ?? 0) + 1 }), {});
  console.log(`${keys.length} bills in scope; ${requests.length} requests: ${plan.summarize.length} simple versions ${JSON.stringify(reasons)}, ${plan.check.length} checks, ${plan.rewrite.length} rewrites; ` +
    `skipped: ${JSON.stringify(plan.skipped)}`);
  if (!requests.length) return { sent: 0 };
  if (DRY) {
    const e = estimate(plan.summarize.length, chars);
    console.log(`estimate for ${plan.summarize.length} new simple versions with their checks: ~${(e.inTok / 1e6).toFixed(2)}M input, ~${(e.outTok / 1e6).toFixed(2)}M output tokens; ` +
      `~$${e.usd.toFixed(2)} at $${PRICE_IN}/$${PRICE_OUT} per million (batch)`);
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
