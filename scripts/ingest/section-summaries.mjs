// Plain-language summaries of each section of a bill's latest official text, written by Claude
// through Anthropic's Batch API (half price; results within hours). Summaries are written once per
// text version and stored; nothing calls the API when someone views a page.
//
// Each run first collects any batch a previous run sent, then sends a new one, then waits up to
// --wait minutes for it. Safe to re-run: sections already summarized, or already in a batch that
// hasn't been collected, are skipped.
//
//   node scripts/ingest/section-summaries.mjs --bills 119-hr-1,119-s-5   (these bills only)
//   node scripts/ingest/section-summaries.mjs --limit 200                 (bills that moved, newest first)
//   options: --wait 60 (minutes), --dry-run (build requests, send nothing), --collect-only,
//            --redo (summarize again and replace, after the instructions change)
//
// Every summary is then checked by a second request that compares it with the section text and
// lists any statement the text doesn't support. A flagged summary is rewritten once with those
// problems named; if the rewrite is flagged too, it is held (status "held") and never published.
// A summary is published (shown on the site) only once it passes the check.
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { sectionsFromXml } from "../../lib/billtext.js";

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const DRY = args.includes("--dry-run");
const COLLECT_ONLY = args.includes("--collect-only");
const BILLS = arg("--bills")?.split(",").map((s) => s.trim()).filter(Boolean);
const LIMIT = arg("--limit") ? parseInt(arg("--limit"), 10) : 100;
const REDO = args.includes("--redo");   // summarize again and replace (after a change to the instructions)
const WAIT_MIN = arg("--wait") ? parseInt(arg("--wait"), 10) : 60;

const MODEL = process.env.SUMMARY_MODEL || "claude-haiku-5-5";
const CHECK_MODEL = process.env.CHECK_MODEL || "claude-haiku-5-5";
const JOB = "section-summaries";
const MIN_WORDS = 40;          // shorter sections are shown as they are; a summary adds nothing
const SKIP_HEADER = /table of contents/i;   // a list of headings; the page already shows them
const MAX_CHARS = 300_000;     // longer sections are skipped and left for a person to read
const MAX_REQUESTS = 20_000;   // per batch (the API allows 100,000)
const API = "https://api.anthropic.com/v1/messages/batches";
const UA = { headers: { "User-Agent": "civic-atlas ingest (github.com/christofogis/civic-atlas)" } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KEY = process.env.ANTHROPIC_API_KEY;
const anthropic = (path, init = {}) => fetch(path.startsWith("http") ? path : `${API}${path}`, {
  ...init,
  headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json", ...(init.headers ?? {}) },
});

// The instructions are fixed and the same for every bill, so every party's bills are summarized the same way.
export const SYSTEM = `You summarize one section of a United States federal bill for a nonpartisan public reference website. Readers are ordinary citizens without legal training. The official text sits right next to your summary, and the summary is labeled as AI-generated.

What to write:
- Start with one plain sentence that says what the section does as a whole.
- If the section has several separate provisions, follow with at most five short lines starting with "- ", one per main provision. Leave out minor and technical provisions; the reader can open the text.
- Say who must, may, or may not do what; what is created, changed, or ended; amounts, dates, deadlines, and who is covered.
- Keep the English to 100 words or fewer.

Plain language:
- Write at about an 8th-grade reading level, in short sentences.
- Leave out section, subsection, and paragraph numbers, U.S. Code citations, redesignations, and conforming or technical amendments. Name a law in words ("the Food and Nutrition Act of 2008"), not by citation.
- When the section only strikes and inserts words in another law and the result can't be understood from this text alone, say which law it amends and what wording it changes, without guessing what the change does.
- If you must use a legal term, explain it in a few words.

Neutrality:
- Use only what the text says. Add no background, history, context, or outside facts, and no descriptive phrases of your own.
- Keep the text's own actors and groups: if the text says "a person engaged in a trade or business", don't write "lenders"; if the President "has received" assurances, don't say who gave them.
- When the text refers to another law's section only by its number, don't say what that section covers; say "the sections of [law] listed in the bill".
- Use the text's own figures, dates, and names exactly. Do not round, total, convert, or estimate.
- Never describe purpose, intent, motive, effect, impact, cost, benefit, fairness, or who gains or loses. If the text itself states a purpose, you may report it as "The section states that its purpose is ...".
- No words that judge or rate, such as significant, major, sweeping, landmark, controversial, harmful, important, modest, strict, generous, loophole, crackdown. A term the bill itself uses (such as "major disaster") is fine.

Spanish:
- Give a faithful Spanish version of the same summary in neutral Latin American Spanish, with the same content and no additions.
- Translate ordinary words and terms the bill defines. Keep the official names of laws and programs in English as printed.

Reply with JSON only, no other text: {"en": "...", "es": "..."}`;

const billLabel = { hr: "H.R.", s: "S.", hjres: "H.J.Res.", sjres: "S.J.Res.", hconres: "H.Con.Res.", sconres: "S.Con.Res.", hres: "H.Res.", sres: "S.Res." };
const ordinal = (n) => `${n}${["th", "st", "nd", "rd"][(n % 100 >= 11 && n % 100 <= 13) ? 0 : (n % 10 < 4 ? n % 10 : 0)]}`;

export function userPrompt(bill, version, s) {
  return [
    `Bill: ${billLabel[bill.bill_type] ?? bill.bill_type} ${bill.number}, ${ordinal(bill.congress)} Congress — ${bill.short_title || bill.title}`,
    `Text version: ${version.version_name}`,
    s.path.length ? `Location in the bill: ${s.path.join(" > ")}` : null,
    `Section heading: ${s.header}`,
    "",
    "Section text:",
    s.text,
  ].filter((x) => x != null).join("\n");
}

// The model's reply -> {en, es}, or null if it isn't the JSON asked for.
export function parseReply(text) {
  const m = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    const en = typeof j.en === "string" ? j.en.trim() : "";
    const es = typeof j.es === "string" ? j.es.trim() : "";
    return en && es ? { en, es } : null;
  } catch { return null; }
}

// The checker's instructions. It never rewrites; it only lists what the text doesn't support.
export const CHECK_SYSTEM = `You check an AI-written summary of one section of a United States federal bill against the section's official text, for a nonpartisan public reference website.

List every statement in the English summary that the text does not support. Look for:
- facts, names, numbers, amounts, or dates that differ from the text;
- who does what: a different actor, or a broader or narrower group than the text names;
- phrases, descriptions, or details that are not in the text, including what a cited law section covers when the text gives only its number;
- any word of judgment, purpose, motive, or effect that the text itself does not state.

Leaving provisions out is allowed and is not a problem. A plain-language rewording that keeps the meaning is not a problem.

Then check that the Spanish says the same as the English, with nothing added or missing.

Reply with JSON only, no other text: {"ok": true, "problems": []} or {"ok": false, "problems": ["<the summary's words> — <what the text says>", ...]}`;

export function checkPrompt(bill, version, s, summary) {
  return `${userPrompt(bill, version, s)}\n\nSummary (English):\n${summary.en}\n\nSummary (Spanish):\n${summary.es}`;
}

// The checker's reply -> {ok, problems}, or null.
export function parseCheck(text) {
  const m = String(text ?? "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (typeof j.ok !== "boolean") return null;
    const problems = Array.isArray(j.problems) ? j.problems.map(String).filter(Boolean) : [];
    return { ok: j.ok && problems.length === 0, problems };
  } catch { return null; }
}

export function rewritePrompt(bill, version, s, problems) {
  return `${userPrompt(bill, version, s)}\n\nA reviewer found these problems in an earlier summary of this section. Write a new summary that avoids them:\n${problems.map((p) => `- ${p}`).join("\n")}`;
}

async function getXml(url) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, UA);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (/^\s*<!DOCTYPE html/i.test(text)) return null;
      return text;
    } catch (err) {
      if (i >= 3) throw new Error(`${url}: ${err.message}`);
      await sleep(2000 * (i + 1));
    }
  }
}

const billKey = (b) => `${b.congress}|${b.bill_type}|${b.number}`;
const RANK = { law: 0, enr: 1, eas: 2, eah: 2, es: 3, eh: 3 };

async function pickBills(db) {
  const versions = await fetchAll(db, "bill_text_versions", "congress,bill_type,number,version_code,seq,version_name,version_date,xml_url,full_text");
  const byBill = new Map();
  for (const v of versions) byBill.set(billKey(v), [...(byBill.get(billKey(v)) ?? []), v]);
  let keys;
  if (BILLS) {
    keys = BILLS.map((s) => { const [c, t, n] = s.split("-"); return `${parseInt(c, 10)}|${t.toLowerCase()}|${parseInt(n, 10)}`; });
  } else {
    // Bills that moved: became law, or passed at least one chamber. Laws first, newest Congress first.
    const rank = (vs) => Math.min(...vs.map((v) => RANK[v.version_code] ?? 9));
    keys = [...byBill.entries()].filter(([, vs]) => rank(vs) < 9)
      .sort(([, a], [, z]) => z[0].congress - a[0].congress || rank(a) - rank(z) ||
        String(z.at(-1).version_date ?? "").localeCompare(String(a.at(-1).version_date ?? "")))
      .map(([k]) => k);
  }
  // The newest version in bill format (a public law's text is the enrolled bill's, in another format).
  const out = [];
  for (const k of keys) {
    const vs = (byBill.get(k) ?? []).filter((v) => v.full_text !== false && /\/xml\/BILLS-/.test(v.xml_url ?? ""))
      .sort((a, z) => z.seq - a.seq);
    if (vs.length) out.push({ key: k, versions: vs });
    else console.log(`${k}: no bill-format text; skipped`);
  }
  return out;
}

const rowKey = (r) => `${r.congress}|${r.bill_type}|${r.number}|${r.version_code}|${r.section_key}`;
const KEYS = ["congress", "bill_type", "number", "version_code", "section_key"];
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
      const kind = item.kind ?? "s";
      const parsed = kind === "c" ? parseCheck(raw) : parseReply(raw);
      if (!parsed) {
        bad++;
        const clip = (x) => JSON.stringify(x.replace(/\s+/g, " "));
        console.log(`${r.custom_id}: reply was not the expected JSON (stop: ${msg.stop_reason}, ${msg.usage?.output_tokens} tokens; ${item.bill_type}${item.number} "${item.header ?? item.section_key}")`);
        console.log(`  starts ${clip(raw.slice(0, 300))}`);
        continue;
      }
      if (kind === "c") checks.push({ item, ...parsed });
      else summaries.push({ ...pick(item, KEYS), path: item.path, header: item.header, words: item.words,
        summary_en: parsed.en, summary_es: parsed.es, model: b.model, batch_id: b.id, published: false,
        status: "unchecked", attempts: item.attempts ?? 1, check_notes: kind === "r" ? item.problems : null, check_model: null });
    }
    if (!DRY) {
      await upsertBatches(db, "bill_section_summaries", summaries, KEYS.join(","), 200);
      await mapLimit(checks, 8, async ({ item, ok, problems }) => {
        const status = ok ? "passed" : (item.attempts ?? 1) >= 2 ? "held" : "flagged";
        // Chris approved publishing (Nov 26, 2026): a summary goes live when it passes the check, never otherwise.
        let q = db.from("bill_section_summaries").update({ status, published: status === "passed", check_notes: problems.length ? problems : null, check_model: b.model });
        for (const k of KEYS) q = q.eq(k, item[k]);
        // Only if the summary checked is still the one stored (a redo may have replaced it).
        const { error: e } = await q.eq("attempts", item.attempts ?? 1).eq("batch_id", item.summary_batch);
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

// The newest version of a bill that splits into sections, cached for the run.
const sectionCache = new Map();
async function billSections(key, versions) {
  if (!sectionCache.has(key)) {
    let found = null;
    for (const v of versions.slice(0, 3)) {
      const xml = await getXml(v.xml_url);
      const s = xml && sectionsFromXml(xml);
      if (s?.length) { found = { version: v, sections: s }; break; }
    }
    sectionCache.set(key, found);
  }
  return sectionCache.get(key);
}

async function send(db, { newSummaries }) {
  const bills = await pickBills(db);
  const versionsByBill = new Map(bills.map((b) => [b.key, b.versions]));
  const stored = await fetchAll(db, "bill_section_summaries", "congress,bill_type,number,version_code,section_key,status,attempts,check_notes,summary_en,summary_es,batch_id");
  const storedByKey = new Map(stored.map((r) => [rowKey(r), r]));
  const storedByBill = new Map();
  for (const r of stored) storedByBill.set(billKey(r), [...(storedByBill.get(billKey(r)) ?? []), r]);
  // Anything already in a batch that hasn't been collected is left alone.
  const inFlight = new Set();
  const { data: open } = await db.from("ai_batches").select("items").eq("job", JOB).eq("status", "sent");
  for (const b of open ?? []) for (const it of Object.values(b.items)) inFlight.add(rowKey(it));

  const meta = new Map((await fetchAll(db, "bills", "congress,bill_type,number,title,short_title")).map((b) => [billKey(b), b]));
  const requests = [], items = {};
  const add = (kind, item, params) => { const id = `${kind}${requests.length}`; items[id] = { kind, ...item }; requests.push({ custom_id: id, params }); };
  const summaryParams = (content) => ({
    // Haiku 5.5 thinks by default and its (hidden) thinking counts toward max_tokens: low effort
    // keeps it short, and the limit leaves room for thinking plus both languages.
    model: MODEL, max_tokens: 8000, output_config: { effort: "low" }, system: SYSTEM, messages: [{ role: "user", content }],
  });
  const checkParams = (content) => ({ model: CHECK_MODEL, max_tokens: 8000, system: CHECK_SYSTEM, messages: [{ role: "user", content }] });

  let billsDone = 0, skippedShort = 0, skippedLong = 0, nNew = 0, nCheck = 0, nRewrite = 0;
  for (const { key, versions } of bills) {
    if (requests.length >= MAX_REQUESTS) break;
    const bill = meta.get(key);
    if (!bill) continue;
    const mine = storedByBill.get(key) ?? [];
    const wantNew = newSummaries && billsDone < LIMIT;
    const needsWork = mine.some((r) => r.status === "unchecked" || r.status === "flagged");
    if (!wantNew && !needsWork) continue;
    const got = await billSections(key, versionsByBill.get(key) ?? versions);
    if (!got) { console.log(`${key}: text didn't split into sections; skipped`); continue; }
    const { version, sections } = got;
    let added = 0;
    for (const s of sections) {
      const k = `${key}|${version.version_code}|${s.key}`;
      if (inFlight.has(k)) continue;
      const base = { congress: bill.congress, bill_type: bill.bill_type, number: bill.number, version_code: version.version_code,
        section_key: s.key, path: s.path, header: s.header, words: s.words };
      const row = storedByKey.get(k);
      if (row && !(REDO && wantNew)) {
        if (row.status === "unchecked") {
          add("c", { ...base, attempts: row.attempts, summary_batch: row.batch_id }, checkParams(checkPrompt(bill, version, s, { en: row.summary_en, es: row.summary_es })));
          nCheck++;
        } else if (row.status === "flagged") {
          add("r", { ...base, attempts: (row.attempts ?? 1) + 1, problems: row.check_notes ?? [] }, summaryParams(rewritePrompt(bill, version, s, row.check_notes ?? [])));
          nRewrite++;
        }
        continue;
      }
      if (!wantNew) continue;
      if (s.words < MIN_WORDS || SKIP_HEADER.test(s.header)) { skippedShort++; continue; }
      if (s.text.length > MAX_CHARS) { skippedLong++; console.log(`${k}: ${s.words} words; too long, skipped`); continue; }
      add("s", { ...base, attempts: 1 }, summaryParams(userPrompt(bill, version, s)));
      nNew++; added++;
    }
    if (wantNew) { billsDone++; console.log(`${key} (${version.version_code}): ${sections.length} sections, ${added} to summarize`); }
  }
  console.log(`${requests.length} requests: ${nNew} new summaries, ${nCheck} checks, ${nRewrite} rewrites; ${skippedShort} short sections or tables of contents left as printed; ${skippedLong} too long`);
  if (!requests.length) return { sent: 0 };
  if (DRY) { console.log("dry run: first request:\n" + JSON.stringify(requests[0], null, 2).slice(0, 3000)); return { sent: 0 }; }

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
  await withRun(db, JOB, async () => {
    // Summarize, check, rewrite what was flagged, check again: one stage per batch, until nothing is
    // left to send and nothing is pending, or the wait runs out (a later run picks up from there).
    const until = Date.now() + WAIT_MIN * 60_000;
    const total = { written: 0, passed: 0, flagged: 0, held: 0, failed: 0 };
    let first = true;
    for (;;) {
      const c = await collect(db);
      for (const k of Object.keys(total)) total[k] += c[k];
      const s = COLLECT_ONLY || c.pending ? { sent: 0 } : await send(db, { newSummaries: first });
      if (!COLLECT_ONLY && !c.pending) first = false;
      if (!s.sent && !c.pending) break;
      if (Date.now() > until) { console.log("wait over; a later run collects what is pending"); break; }
      await sleep(60_000);
    }
    console.log("done", total);
    return { rows_inserted: total.written, rows_updated: total.passed + total.flagged + total.held };
  });
}
