// AI summaries for /constitution, written once into data/constitution/us.json (the text never
// changes, so there is no database table and nothing runs on a schedule). Two levels per part, each in
// English and Spanish: a plain-language summary of what the words say, and a shorter "Explain it
// simply" version. Written by Claude through Anthropic's Batch API, the same flow as the bill
// summaries (scripts/ingest/section-summaries.mjs, bill-simple-summaries.mjs):
//   write -> check against the verbatim text -> if flagged, rewrite once with the problems named ->
//   check again -> flagged twice: held. Only "passed" summaries are shown on the page.
//
// State lives in the data file: each summary carries its status, attempts and the hash of the text it
// was written from; batches sent but not yet collected are listed under "batches", so a run that
// runs out of --wait leaves them for the next run to collect. The workflow commits the file.
//
//   node scripts/data/constitution-summaries.mjs --dry-run      (print one request and a cost estimate)
//   node scripts/data/constitution-summaries.mjs --wait 90
//   options: --parts amend14,art1-s8 (these only), --redo (write again, after the instructions change),
//            --collect-only
import { readFileSync, writeFileSync } from "node:fs";
import { parseReply, parseCheck } from "../ingest/section-summaries.mjs";
import { sentences } from "../ingest/bill-simple-summaries.mjs";
import { partText, roman } from "../../lib/constitution.js";

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const DRY = args.includes("--dry-run");
const REDO = args.includes("--redo");
const COLLECT_ONLY = args.includes("--collect-only");
const ONLY = arg("--parts")?.split(",").map((s) => s.trim()).filter(Boolean);
const WAIT_MIN = arg("--wait") ? parseInt(arg("--wait"), 10) : 90;

export const FILE = "data/constitution/us.json";
const MODEL = process.env.SUMMARY_MODEL || "claude-haiku-5-5";
const CHECK_MODEL = process.env.CHECK_MODEL || "claude-haiku-5-5";
const API = "https://api.anthropic.com/v1/messages/batches";
// Batch prices per million tokens, for the --dry-run estimate only (the bill summary jobs use the same).
const PRICE_IN = Number(process.env.PRICE_IN_PER_MTOK ?? 0.5);
const PRICE_OUT = Number(process.env.PRICE_OUT_PER_MTOK ?? 2.5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = (path, init = {}) => fetch(path.startsWith("http") ? path : `${API}${path}`, {
  ...init,
  headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(init.headers ?? {}) },
});

// Rules shared by both levels. The same fixed instructions for every part.
const WORDS_ONLY = `Describe only what the words say:
- Say who must, may, or may not do what, as the text states it. "Shall" means must; "may" means may. Never turn one into the other.
- Keep the text's own actors and groups ("the Congress", "each State", "the People", "any person", "citizens"); don't make a group broader or narrower, and don't name who a phrase refers to when the text doesn't. If the text says "all other Persons", write "all other persons".
- Use the text's own numbers, ages, dates, and fractions. You may write a number as digits (25 for "twenty five").
- When the text lists several items of the same kind (such as powers, rights, or offices), name them all or describe them all as one group; never single some out.
- Modern words for old spellings are fine ("choose" for "chuse").

What to leave out:
- No purpose, reason, intent, or importance, and no effect or impact. If the text itself states a purpose (as the Preamble does), you may report it as "It states that ...".
- No history and no background: no framers, debates, events, or what came before or after, other than what the user message gives about other parts of the Constitution. Don't mention the ratification date; the page shows it.
- No interpretation: never say how courts, Congress, or anyone else has read, applied, or enforced the text, what it protects or allows in practice, or what a term has come to mean. Another site, linked next to yours, covers that.
- No modern examples, no analogies, comparisons, or metaphors, and no hypotheticals.
- No words that judge or rate, such as important, fundamental, famous, key, significant, landmark, powerful, strict, broad, controversial, fair, unfair.

Amendments and later changes:
- When the user message says this part changed or repealed earlier text, say factually what it changed, naming the earlier part (for example "It replaces the earlier rule in Article I, Section 3 that ..."), using only the words of both texts.
- When the user message says a later amendment changed words in this part, end with one sentence saying which words were later changed and by which amendment, without saying what the change means.`;

const SPANISH = (shape) => `Spanish:
- Give a faithful Spanish version in neutral Latin American Spanish, with the same content${shape} and no additions.
- Use "Constitución", "Congreso", "Cámara de Representantes", "Senado", "Presidente", "Vicepresidente", "Estado(s)".`;

export const SUMMARY_SYSTEM = `You summarize one part of the Constitution of the United States for a nonpartisan public reference website. Readers are ordinary citizens without legal training. The part's verbatim text is one tap away from your summary, and the summary is labeled as AI-generated and checked against the text.

What to write:
- Start with one plain sentence that says what the part does as a whole.
- If the part has several clauses or provisions, follow with at most eight short lines starting with "- ", one per clause or provision, in the order of the text.
- Keep the English to 140 words or fewer. Write at about an 8th-grade reading level, in short sentences.
- If you must use a legal term, explain it in a few words taken from the text.

${WORDS_ONLY}

${SPANISH("")}

Reply with JSON only, no other text: {"en": "...", "es": "..."}`;

export const SIMPLE_SYSTEM = `You write a very simple explanation of one part of the Constitution of the United States for a nonpartisan public reference website. Readers include young people and adults who find legal language hard to read. A longer plain-language summary and the verbatim text are one tap away from yours, and yours is labeled as AI-generated and checked against the text.

What to write:
- Two to four short sentences that say what the part says. Each sentence has about 15 words or fewer.
- Write at about a 5th-grade reading level: short, common words. No legal terms; say what a term means in everyday words taken from the text instead.
- The main things the part says, in the order of the text. Leave out details rather than adding any.

${WORDS_ONLY}

${SPANISH(", the same number of sentences,")}

Reply with JSON only, no other text: {"en": "...", "es": "..."}`;

const CHECK_LIST = `List every problem you find. Look for:
- any statement the text does not support: facts, numbers, ages, dates, or offices that differ from the text or that it doesn't contain;
- who does what: a different actor, or a broader or narrower group than the text names, or naming who a phrase refers to when the text doesn't;
- "must" where the text says "may", or "may" where it says "shall" or "must";
- a statement that leaves out a condition, limit, or exception so that the statement itself becomes untrue;
- singling out: when the text lists several items of the same kind, naming only some of them as if they were all, or describing some differently from the rest;
- purpose, reason, intent, importance, effect, or impact that the text itself does not state;
- history or background, including the ratification date, framers, events, or what came before or after (a factual statement of what an amendment changed in an earlier part, given in the user message, is allowed);
- interpretation: how courts or anyone else have read or applied the text, what it protects or allows in practice, or what a term has come to mean;
- modern examples, analogies, comparisons, metaphors, or hypotheticals;
- words that judge or rate (such as important, fundamental, famous, key, significant, broad, strict, fair).`;

export const CHECK_SYSTEM = `You check an AI-written plain-language summary of one part of the Constitution of the United States against the part's verbatim text, for a nonpartisan public reference website.

Leaving clauses out is allowed and is not a problem. A plain-language rewording that keeps the meaning is not a problem. Modern spelling is not a problem.

${CHECK_LIST}

Then check that the Spanish says the same as the English, with nothing added or missing.

Reply with JSON only, no other text: {"ok": true, "problems": []} or {"ok": false, "problems": ["<the summary's words> — <what the text says>", ...]}`;

export const SIMPLE_CHECK_SYSTEM = `You check an AI-written very simple explanation (two to four short sentences) of one part of the Constitution of the United States against the part's verbatim text, for a nonpartisan public reference website.

The explanation is meant to be simpler than the text, so it may leave out details and use everyday words. That alone is not a problem. But every statement it makes must be true to the text.

${CHECK_LIST}
- legal terms left unexplained.

Then check that the Spanish says the same as the English, with nothing added or missing.

Reply with JSON only, no other text: {"ok": true, "problems": []} or {"ok": false, "problems": ["<the explanation's words> — <what the text says>", ...]}`;

const amendmentName = (id) => `Amendment ${roman(Number(id.replace("amend", "")))}`;

// The user message: the part's heading and verbatim text, plus the factual cross-references the
// National Archives gives (which earlier text this part changed, and which later amendment changed it).
export function userPrompt(part, all = []) {
  const byId = new Map(all.map((p) => [p.id, p]));
  const lines = [`Part: ${part.heading.en} of the Constitution of the United States`];
  const later = [...(part.changes ?? []), ...part.blocks.flatMap((b) => (b.changes ?? []).map((c) => ({ ...c, clause: b.clause, section: b.section })))];
  for (const c of later) {
    const where = c.clause ? `Clause ${c.clause}` : c.section ? `Section ${c.section}` : "This part";
    const by = `${amendmentName(c.by)}${c.by_section ? `, Section ${c.by_section}` : ""}`;
    lines.push(c.verb === "repealed" ? `Later change: this amendment was repealed by ${by}.`
      : c.passage ? `Later change: in ${where}, the words "${c.passage}" were ${c.verb} by ${by}.` : `Later change: ${where} was ${c.verb} by ${by}.`);
  }
  for (const id of part.changes_parts ?? []) {
    const p = byId.get(id);
    if (!p) continue;
    const marked = p.blocks.flatMap((b) => (b.changes ?? []).filter((c) => c.by === part.id).map((c) => ({ b, c })));
    const rep = (p.changes ?? []).find((c) => c.by === part.id && c.verb === "repealed");
    if (rep) { lines.push(`This part repealed ${p.heading.en}, whose text was:\n${partText(p)}`); continue; }
    for (const { b, c } of marked) {
      lines.push(`This part ${c.verb} earlier text in ${p.heading.en}${b.clause ? `, Clause ${b.clause}` : b.section ? `, Section ${b.section}` : ""}${c.passage ? `, the words: "${c.passage}"` : `, which reads: "${b.text}"`}`);
    }
  }
  lines.push("", "Verbatim text:", partText(part));
  return lines.join("\n");
}

export const checkPrompt = (part, all, s) => `${userPrompt(part, all)}\n\nSummary (English):\n${s.en}\n\nSummary (Spanish):\n${s.es}`;
export const rewritePrompt = (part, all, problems) =>
  `${userPrompt(part, all)}\n\nA reviewer found these problems in an earlier version. Write a new one that avoids them:\n${problems.map((p) => `- ${p}`).join("\n")}`;

const words = (s) => s.split(/\s+/).filter(Boolean).length;
// The simple level: {en, es} with at most five sentences and 90 words each (asked for two to four short sentences).
export function parseSimpleReply(text) {
  const r = parseReply(text);
  if (!r) return null;
  const clean = { en: r.en.replace(/\s+/g, " ").trim(), es: r.es.replace(/\s+/g, " ").trim() };
  for (const t of [clean.en, clean.es]) if (sentences(t) > 5 || words(t) > 90) return null;
  return clean;
}
// The summary level: {en, es}, at most 200 words each (asked for 140 in English).
export function parseSummaryReply(text) {
  const r = parseReply(text);
  if (!r) return null;
  for (const t of [r.en, r.es]) if (words(t) > 200) return null;
  return r;
}

const LEVELS = {
  summary: { system: SUMMARY_SYSTEM, check: CHECK_SYSTEM, parse: parseSummaryReply },
  simple: { system: SIMPLE_SYSTEM, check: SIMPLE_CHECK_SYSTEM, parse: parseSimpleReply },
};
const writeParams = (level, content) => ({ model: MODEL, max_tokens: 8000, output_config: { effort: "low" }, system: LEVELS[level].system, messages: [{ role: "user", content }] });
const checkParams = (level, content) => ({ model: CHECK_MODEL, max_tokens: 6000, output_config: { effort: "low" }, system: LEVELS[level].check, messages: [{ role: "user", content }] });

// What to send next, from the stored state: a new summary (s), a check (c) or a rewrite (r) for each
// part and level. Anything in a batch not yet collected is skipped.
export function plan(data, { only = null, redo = false } = {}) {
  const inFlight = new Set((data.batches ?? []).flatMap((b) => Object.values(b.items).map((i) => `${i.part}|${i.level}`)));
  const out = [];
  for (const part of data.parts) {
    if (only && !only.includes(part.id)) continue;
    for (const level of Object.keys(LEVELS)) {
      if (inFlight.has(`${part.id}|${level}`)) continue;
      const s = part[level];
      const stale = s && s.text_hash !== part.text_hash;
      if (!s || stale || redo) out.push({ kind: "s", part: part.id, level, attempts: 1 });
      else if (s.status === "unchecked") out.push({ kind: "c", part: part.id, level, attempts: s.attempts });
      else if (s.status === "flagged") out.push({ kind: "r", part: part.id, level, attempts: (s.attempts ?? 1) + 1 });
    }
  }
  return out;
}

export function requestsFor(data, steps) {
  const byId = new Map(data.parts.map((p) => [p.id, p]));
  const items = {}, requests = [];
  for (const st of steps) {
    const part = byId.get(st.part);
    const id = `${st.kind}-${st.level}-${st.part}`;
    const content = st.kind === "c" ? checkPrompt(part, data.parts, part[st.level])
      : st.kind === "r" ? rewritePrompt(part, data.parts, part[st.level].check_notes ?? []) : userPrompt(part, data.parts);
    items[id] = st;
    requests.push({ custom_id: id, params: st.kind === "c" ? checkParams(st.level, content) : writeParams(st.level, content) });
  }
  return { items, requests };
}

// Apply one batch's results to the data (in place). Returns counts.
export function applyResults(data, batch, results) {
  const byId = new Map(data.parts.map((p) => [p.id, p]));
  const t = { written: 0, passed: 0, flagged: 0, held: 0, failed: 0, input_tokens: 0, output_tokens: 0 };
  for (const r of results) {
    const item = batch.items[r.custom_id];
    if (!item) continue;
    const part = byId.get(item.part);
    if (r.result?.type !== "succeeded") { t.failed++; console.log(`${r.custom_id}: ${r.result?.type}`); continue; }
    const msg = r.result.message;
    t.input_tokens += msg.usage?.input_tokens ?? 0; t.output_tokens += msg.usage?.output_tokens ?? 0;
    const raw = msg.content?.find((c) => c.type === "text")?.text ?? "";
    if (item.kind === "c") {
      const c = parseCheck(raw);
      const s = part[item.level];
      if (!c || !s || s.attempts !== item.attempts) { t.failed++; continue; }
      s.status = c.ok ? "passed" : item.attempts >= 2 ? "held" : "flagged";
      s.check_notes = c.problems.length ? c.problems : null;
      s.check_model = batch.model;
      t[s.status]++;
    } else {
      const p = LEVELS[item.level].parse(raw);
      if (!p) { t.failed++; console.log(`${r.custom_id}: reply was not the expected JSON: ${JSON.stringify(raw.slice(0, 200))}`); continue; }
      part[item.level] = { en: p.en, es: p.es, status: "unchecked", attempts: item.attempts, model: batch.model, batch_id: batch.id,
        text_hash: part.text_hash, check_notes: item.kind === "r" ? part[item.level]?.check_notes ?? null : null };
      t.written++;
    }
  }
  return t;
}

// Rough cost: the real prompts' length (4 characters a token), and output sized from the bill summary
// batches of Nov 27, 2026 at low effort (~1,500 tokens a summary with its hidden thinking, ~900 a
// simple version, ~700 a check), plus 25% for rewrites and second checks.
export function estimate(data) {
  let inTok = 0, outTok = 0;
  for (const part of data.parts) {
    const u = userPrompt(part, data.parts).length;
    inTok += (SUMMARY_SYSTEM.length + u + CHECK_SYSTEM.length + u + 700) / 4;
    inTok += (SIMPLE_SYSTEM.length + u + SIMPLE_CHECK_SYSTEM.length + u + 400) / 4;
    outTok += 1500 + 700 + 900 + 700;
  }
  inTok = Math.round(inTok * 1.25); outTok = Math.round(outTok * 1.25);
  return { requests: data.parts.length * 4, inTok, outTok, usd: (inTok * PRICE_IN + outTok * PRICE_OUT) / 1e6 };
}

const save = (data) => writeFileSync(FILE, JSON.stringify(data, null, 1) + "\n");

async function collect(data) {
  let pending = 0;
  for (const b of [...(data.batches ?? [])]) {
    const res = await anthropic(`/${b.id}`);
    if (!res.ok) throw new Error(`batch ${b.id}: HTTP ${res.status}`);
    const info = await res.json();
    if (info.processing_status !== "ended") { pending++; console.log(`batch ${b.id}: ${info.processing_status}`, info.request_counts); continue; }
    const out = await anthropic(info.results_url);
    if (!out.ok) throw new Error(`batch ${b.id} results: HTTP ${out.status}`);
    const results = (await out.text()).split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
    const t = applyResults(data, b, results);
    data.batches = data.batches.filter((x) => x.id !== b.id);
    save(data);
    console.log(`batch ${b.id}: collected`, t);
  }
  return pending;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  if (!KEY && !DRY) throw new Error("ANTHROPIC_API_KEY must be set");
  const data = JSON.parse(readFileSync(FILE, "utf8"));
  data.batches ??= [];
  if (DRY) {
    const steps = plan(data, { only: ONLY, redo: REDO });
    const { requests } = requestsFor(data, steps);
    const e = estimate(data);
    console.log(`${steps.length} requests to send now (${steps.filter((s) => s.kind === "s").length} new, ${steps.filter((s) => s.kind === "c").length} checks, ${steps.filter((s) => s.kind === "r").length} rewrites)`);
    console.log(`estimate for the whole job (${data.parts.length} parts x 2 levels, written and checked, +25% for rewrites): ~${(e.inTok / 1e3).toFixed(0)}k input, ~${(e.outTok / 1e3).toFixed(0)}k output tokens; ~$${e.usd.toFixed(2)} at $${PRICE_IN}/$${PRICE_OUT} per million (batch)`);
    if (requests[0]) console.log("first request:\n" + JSON.stringify(requests[0], null, 2).slice(0, 6000));
  } else {
    const until = Date.now() + WAIT_MIN * 60_000;
    let redo = REDO;
    for (;;) {
      const pending = await collect(data);
      let sent = 0;
      if (!COLLECT_ONLY && !pending) {
        const steps = plan(data, { only: ONLY, redo });
        redo = false;   // --redo applies to the first round only; later rounds check and rewrite
        if (steps.length) {
          const { items, requests } = requestsFor(data, steps);
          const res = await anthropic("", { method: "POST", body: JSON.stringify({ requests }) });
          if (!res.ok) throw new Error(`send batch: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
          const batch = await res.json();
          data.batches.push({ id: batch.id, model: MODEL, created_at: new Date().toISOString(), items });
          save(data);
          sent = requests.length;
          console.log(`sent batch ${batch.id}: ${requests.length} requests`);
        }
      }
      if (!sent && !pending) break;
      if (Date.now() > until) { console.log("wait over; the next run collects what is pending"); break; }
      await sleep(60_000);
    }
    const count = (lv, st) => data.parts.filter((p) => p[lv]?.status === st).length;
    for (const lv of Object.keys(LEVELS)) console.log(`${lv}: ${count(lv, "passed")} passed, ${count(lv, "held")} held, ${count(lv, "unchecked") + count(lv, "flagged")} in progress, of ${data.parts.length}`);
  }
}
