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
//   options: --wait 60 (minutes), --dry-run (build requests, send nothing), --collect-only
//
// Rows are stored with published = false; the site shows only published rows.
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { sectionsFromXml } from "../../lib/billtext.js";

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const DRY = args.includes("--dry-run");
const COLLECT_ONLY = args.includes("--collect-only");
const BILLS = arg("--bills")?.split(",").map((s) => s.trim()).filter(Boolean);
const LIMIT = arg("--limit") ? parseInt(arg("--limit"), 10) : 100;
const WAIT_MIN = arg("--wait") ? parseInt(arg("--wait"), 10) : 60;

const MODEL = process.env.SUMMARY_MODEL || "claude-haiku-5-5";
const JOB = "section-summaries";
const MIN_WORDS = 40;          // shorter sections are shown as they are; a summary adds nothing
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
export const SYSTEM = `You summarize one section of a United States federal bill for a nonpartisan public reference website. Readers are ordinary citizens. The official text sits right next to your summary, and the summary is labeled as AI-generated.

Rules:
- Say what the section does, in plain words: who must, may, or may not do what; what is created, changed, or ended; which law is amended; amounts, dates, deadlines, and conditions.
- Use only what the text says. Add no background, history, context, or outside facts.
- Use the text's own figures, dates, and names exactly. Do not round, total, convert, or estimate.
- Never describe purpose, intent, motive, effect, impact, cost, benefit, fairness, or who gains or loses. If the text itself states a purpose, you may report it as "The section states that its purpose is ...".
- No words that judge or rate: for example significant, major, sweeping, landmark, controversial, harmful, important, modest, strict, generous, loophole, crackdown.
- When the section amends another law by striking and inserting words and the result can't be understood from this text alone, say which law and provision it amends and what wording it changes. Do not guess what the change does.
- Write at about an 8th-grade reading level. If you must use a legal term, explain it in a few words.
- Length: one or two sentences for a simple section; at most five sentences, or at most six short lines starting with "- " when the section has several separate provisions. Never longer than needed.
- Spanish: give a faithful Spanish version of the same summary in neutral Latin American Spanish, with the same content and no additions. Keep official names of laws, programs, and agencies in English as printed.

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

async function collect(db) {
  const { data: open, error } = await db.from("ai_batches").select("id,model,items,created_at").eq("job", JOB).eq("status", "sent");
  if (error) throw new Error(`read ai_batches: ${error.message}`);
  let written = 0, failed = 0, pending = 0;
  for (const b of open) {
    const res = await anthropic(`/${b.id}`);
    if (!res.ok) throw new Error(`batch ${b.id}: HTTP ${res.status}`);
    const info = await res.json();
    if (info.processing_status !== "ended") { pending++; console.log(`batch ${b.id}: ${info.processing_status}`, info.request_counts); continue; }
    const out = await anthropic(info.results_url);
    if (!out.ok) throw new Error(`batch ${b.id} results: HTTP ${out.status}`);
    const rows = [];
    let bad = 0, inTok = 0, outTok = 0;
    for (const line of (await out.text()).split("\n")) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const item = b.items[r.custom_id];
      if (!item) continue;
      if (r.result?.type !== "succeeded") { bad++; console.log(`${r.custom_id}: ${r.result?.type} ${r.result?.error?.type ?? ""}`); continue; }
      const msg = r.result.message;
      inTok += msg.usage?.input_tokens ?? 0; outTok += msg.usage?.output_tokens ?? 0;
      const s = parseReply(msg.content?.find((c) => c.type === "text")?.text);
      if (!s) { bad++; console.log(`${r.custom_id}: reply was not the expected JSON`); continue; }
      rows.push({ ...item, summary_en: s.en, summary_es: s.es, model: b.model, batch_id: b.id, published: false });
    }
    if (!DRY) await upsertBatches(db, "bill_section_summaries", rows, "congress,bill_type,number,version_code,section_key", 200);
    const counts = { written: rows.length, failed: bad, input_tokens: inTok, output_tokens: outTok };
    await db.from("ai_batches").update({ status: "collected", collected_at: new Date().toISOString(), counts }).eq("id", b.id);
    console.log(`batch ${b.id}: collected`, counts);
    written += rows.length; failed += bad;
  }
  return { written, failed, pending };
}

async function send(db) {
  const bills = await pickBills(db);
  const done = new Set((await fetchAll(db, "bill_section_summaries", "congress,bill_type,number,version_code,section_key"))
    .map((r) => `${r.congress}|${r.bill_type}|${r.number}|${r.version_code}|${r.section_key}`));
  const { data: open } = await db.from("ai_batches").select("items").eq("job", JOB).eq("status", "sent");
  for (const b of open ?? []) for (const it of Object.values(b.items)) done.add(`${it.congress}|${it.bill_type}|${it.number}|${it.version_code}|${it.section_key}`);

  const meta = new Map((await fetchAll(db, "bills", "congress,bill_type,number,title,short_title")).map((b) => [billKey(b), b]));
  const requests = [], items = {};
  let billsDone = 0, skippedShort = 0, skippedLong = 0;
  for (const { key, versions } of bills) {
    if (billsDone >= LIMIT || requests.length >= MAX_REQUESTS) break;
    const bill = meta.get(key);
    if (!bill) continue;
    // Newest version that splits into sections.
    let version = null, sections = null;
    for (const v of versions.slice(0, 3)) {
      const xml = await getXml(v.xml_url);
      const s = xml && sectionsFromXml(xml);
      if (s?.length) { version = v; sections = s; break; }
    }
    if (!sections) { console.log(`${key}: text didn't split into sections; skipped`); continue; }
    let added = 0;
    for (const s of sections) {
      const k = `${key}|${version.version_code}|${s.key}`;
      if (done.has(k)) continue;
      if (s.words < MIN_WORDS) { skippedShort++; continue; }
      if (s.text.length > MAX_CHARS) { skippedLong++; console.log(`${k}: ${s.words} words; too long, skipped`); continue; }
      const id = `s${requests.length}`;
      items[id] = { congress: bill.congress, bill_type: bill.bill_type, number: bill.number, version_code: version.version_code,
        section_key: s.key, path: s.path, header: s.header, words: s.words };
      requests.push({ custom_id: id, params: {
        model: MODEL, max_tokens: 1000, system: SYSTEM,
        messages: [{ role: "user", content: userPrompt(bill, version, s) }],
      } });
      done.add(k);
      added++;
    }
    billsDone++;
    console.log(`${key} (${version.version_code}): ${sections.length} sections, ${added} to summarize`);
  }
  console.log(`${billsDone} bills, ${requests.length} sections to summarize; ${skippedShort} under ${MIN_WORDS} words left as printed; ${skippedLong} too long`);
  if (!requests.length) return { sent: 0, batch: null };
  if (DRY) { console.log("dry run: first request:\n" + JSON.stringify(requests[0], null, 2).slice(0, 3000)); return { sent: 0, batch: null }; }

  const res = await anthropic("", { method: "POST", body: JSON.stringify({ requests }) });
  if (!res.ok) throw new Error(`send batch: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const batch = await res.json();
  const { error } = await db.from("ai_batches").insert({ id: batch.id, job: JOB, model: MODEL, items });
  if (error) throw new Error(`record batch ${batch.id}: ${error.message}`);
  console.log(`sent batch ${batch.id} with ${requests.length} requests`);
  return { sent: requests.length, batch: batch.id };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  if (!KEY && !DRY) throw new Error("ANTHROPIC_API_KEY must be set");
  const db = getClient();
  await withRun(db, JOB, async () => {
    let c = await collect(db);
    const s = COLLECT_ONLY ? { sent: 0 } : await send(db);
    // Wait for what was just sent, so a small run finishes in one go.
    const until = Date.now() + WAIT_MIN * 60_000;
    while (s.sent && Date.now() < until) {
      await sleep(60_000);
      const next = await collect(db);
      c = { written: c.written + next.written, failed: c.failed + next.failed, pending: next.pending };
      if (!next.pending) break;
    }
    console.log("done", { ...c, sent: s.sent });
    return { rows_inserted: c.written };
  });
}
