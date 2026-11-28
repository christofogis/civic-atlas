import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textLines, parseConstitution, parseLaterAmendments, isoDate, partText, shownSummary, matchesQuery, CHANGES, annotatedUrl } from "../lib/constitution.js";
import { textHash } from "../scripts/data/constitution-text.mjs";
import { userPrompt, checkPrompt, rewritePrompt, parseSimpleReply, parseSummaryReply, plan, applyResults, estimate,
  SUMMARY_SYSTEM, SIMPLE_SYSTEM, CHECK_SYSTEM, SIMPLE_CHECK_SYSTEM } from "../scripts/data/constitution-summaries.mjs";

const data = JSON.parse(readFileSync(new URL("../data/constitution/us.json", import.meta.url), "utf8"));
const byId = new Map(data.parts.map((p) => [p.id, p]));

test("every part of the Constitution is there once, in order", () => {
  const ids = data.parts.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[0], "preamble");
  const sections = { 1: 10, 2: 4, 3: 3, 4: 4 };
  for (const [a, n] of Object.entries(sections)) for (let s = 1; s <= n; s++) assert.ok(byId.has(`art${a}-s${s}`), `art${a}-s${s}`);
  for (const a of [5, 6, 7]) assert.ok(byId.has(`art${a}`));
  for (let n = 1; n <= 27; n++) assert.ok(byId.has(`amend${n}`), `amend${n}`);
  assert.equal(ids.length, 1 + 21 + 3 + 27);
  assert.deepEqual([...new Set(data.parts.map((p) => p.group))], ["preamble", "articles", "bill-of-rights", "amendments"]);
});

test("every part has its verbatim text, headings in both languages, and source links", () => {
  for (const p of data.parts) {
    assert.ok(p.blocks.length > 0 && p.blocks.every((b) => typeof b.text === "string" && b.text.length > 10), p.id);
    assert.ok(p.heading.en && p.heading.es, p.id);
    assert.match(p.sources.official, /^https:\/\/www\.archives\.gov\/founding-docs\//, p.id);
    assert.match(p.sources.annotated, /^https:\/\/constitution\.congress\.gov\/browse\/[a-z0-9/-]+\/$/, p.id);
    assert.equal(p.text_hash, textHash(p), `${p.id}: text_hash`);
  }
  assert.equal(byId.get("art1-s8").blocks.length, 18);
  assert.equal(byId.get("art1-s8").blocks[2].clause, 3);
  assert.equal(byId.get("art1-s1").blocks[0].clause, undefined);
  assert.equal(annotatedUrl({ kind: "article", article: 1, section: 8 }), "https://constitution.congress.gov/browse/article-1/section-8/");
});

test("original spelling and capitalization are kept", () => {
  assert.match(byId.get("preamble").blocks[0].text, /provide for the common defence, promote the general Welfare/);
  assert.match(partText(byId.get("art1-s2")), /shall chuse their Speaker/);
  assert.match(partText(byId.get("art1-s10")), /it's inspection Laws/);
  assert.match(partText(byId.get("amend6")), /Assistance of Counsel for his defence\.$/);
});

test("amendments carry the dates the National Archives gives", () => {
  for (const p of data.parts.filter((x) => x.kind === "amendment")) {
    assert.match(p.ratified, /^\d{4}-\d{2}-\d{2}$/, p.id);
    assert.match(p.passed, /^\d{4}-\d{2}-\d{2}$/, p.id);
    assert.ok(p.dates_text, p.id);
  }
  assert.equal(byId.get("amend1").ratified, "1791-12-15");
  assert.equal(byId.get("amend11").ratified, "1795-02-07");
  assert.equal(byId.get("amend27").passed, "1789-09-25");
  assert.equal(byId.get("amend27").ratified, "1992-05-07");
  assert.equal(byId.get("amend18").repealed_by, 21);
  assert.equal(isoDate("Sept. 25, 1789"), "1789-09-25");
});

test("changed passages are marked as the Archives marks them, and cross-linked", () => {
  const marked = data.parts.flatMap((p) => [...(p.changes ?? []), ...p.blocks.flatMap((b) => b.changes ?? [])]);
  assert.equal(marked.length, CHANGES.length);
  const c = byId.get("art1-s2").blocks.find((b) => b.clause === 3).changes[0];
  assert.equal(c.by, "amend14");
  assert.match(c.note.en, /Amendment XIV, Section 2/);
  assert.ok(byId.get("art1-s2").blocks[2].text.includes(c.passage));
  assert.deepEqual(byId.get("amend17").changes_parts, ["art1-s3"]);
  assert.equal(byId.get("amend18").changes[0].verb, "repealed");
  for (const m of marked) { assert.ok(m.note.en && m.note.es); assert.doesNotMatch(m.note.en, /good|bad|important|ended slavery/i); }
});

test("summaries: shown only when passed and written from the stored text; otherwise the page falls back", () => {
  for (const p of data.parts) for (const lv of ["summary", "simple"]) {
    const s = shownSummary(p, lv);
    assert.ok(s === null || (s.en && s.es), `${p.id} ${lv}`);
  }
  const p = { text_hash: "a", summary: { en: "E", es: "S", status: "passed", text_hash: "a" } };
  assert.deepEqual(shownSummary(p), { en: "E", es: "S" });
  assert.equal(shownSummary({ ...p, summary: { ...p.summary, status: "held" } }), null);
  assert.equal(shownSummary({ ...p, text_hash: "b" }), null);
  assert.equal(shownSummary(p, "simple"), null);
});

test("search matches headings, text and shown summaries, ignoring accents and case", () => {
  assert.ok(matchesQuery(byId.get("amend1"), "freedom of SPEECH"));
  assert.ok(matchesQuery(byId.get("art1-s9"), "habeas corpus"));
  assert.ok(matchesQuery(byId.get("amend14"), "enmienda xiv", "es"));
  assert.ok(!matchesQuery(byId.get("amend2"), "habeas"));
  assert.ok(matchesQuery(byId.get("amend2"), ""));
});

test("parsers read the transcription's text lines", () => {
  const lines = textLines("<main><p>We the People of the United States, do ordain.</p><p>Article. I.</p><p>Section. 1.</p><p>All legislative Powers&nbsp;herein.</p>" +
    "<p>Section. 2.</p><p>First.</p><p>Second &amp; last.</p><p>Article. II.</p><p>One.</p><p>The Word, \"the,\" being interlined</p></main>");
  const parts = parseConstitution(lines);
  assert.deepEqual(parts.map((p) => p.id), ["preamble", "art1-s1", "art1-s2", "art2"]);
  assert.deepEqual(parts[2].blocks, [{ text: "First.", clause: 1 }, { text: "Second & last.", clause: 2 }]);
  assert.throws(() => parseLaterAmendments(["AMENDMENT XI", "Passed by Congress March 4, 1794. Ratified February 7, 1795.", "Text."]), /1 amendments, not 17/);
});

test("prompts carry the verbatim text and the Archives' cross-references, and are the same for every part", () => {
  const u = userPrompt(byId.get("amend17"), data.parts);
  assert.match(u, /^Part: Amendment XVII of the Constitution/);
  assert.match(u, /This part modified earlier text in Article I, Section 3, Clause 1, the words: "chosen by the Legislature"/);
  assert.match(u, /Verbatim text:\nThe Senate of the United States shall be composed/);
  assert.match(userPrompt(byId.get("art1-s2"), data.parts), /Later change: in Clause 3, the words "Representatives and direct Taxes[^"]+" were modified by Amendment XIV, Section 2\./);
  assert.match(userPrompt(byId.get("amend21"), data.parts), /This part repealed Amendment XVIII, whose text was:/);
  assert.match(checkPrompt(byId.get("amend1"), data.parts, { en: "E", es: "S" }), /Summary \(English\):\nE\n\nSummary \(Spanish\):\nS$/);
  assert.match(rewritePrompt(byId.get("amend1"), data.parts, ["adds history"]), /- adds history$/);
  for (const s of [SUMMARY_SYSTEM, SIMPLE_SYSTEM, CHECK_SYSTEM, SIMPLE_CHECK_SYSTEM]) {
    assert.doesNotMatch(s, /Republican|Democrat|conservative|liberal/i);
    assert.match(s, /JSON only/);
  }
  assert.match(SUMMARY_SYSTEM, /No interpretation/);
  assert.match(SIMPLE_SYSTEM, /No modern examples, no analogies/);
});

test("reply parsers need both languages and keep to the length asked", () => {
  assert.deepEqual(parseSummaryReply('{"en":"Sets the term.","es":"Fija el período."}'), { en: "Sets the term.", es: "Fija el período." });
  assert.equal(parseSummaryReply('{"en":"A"}'), null);
  assert.equal(parseSummaryReply(JSON.stringify({ en: "word ".repeat(201), es: "x" })), null);
  assert.deepEqual(parseSimpleReply('{"en":"It sets a rule.  It names who.","es":"Fija una regla. Dice quién."}'), { en: "It sets a rule. It names who.", es: "Fija una regla. Dice quién." });
  assert.equal(parseSimpleReply(JSON.stringify({ en: "One. Two. Three. Four. Five. Six.", es: "Uno." })), null);
});

test("plan and applyResults: write, check, rewrite once, then hold", () => {
  const d = { parts: [{ id: "amend1", text_hash: "h", heading: { en: "Amendment I" }, blocks: [{ text: "Congress shall make no law." }] }], batches: [] };
  assert.deepEqual(plan(d).map((s) => `${s.kind}-${s.level}`), ["s-summary", "s-simple"]);
  const ok = (text) => ({ type: "succeeded", message: { usage: {}, content: [{ type: "text", text }] } });
  const batch = (items) => ({ id: "b1", model: "m", items });
  applyResults(d, batch({ x: { kind: "s", part: "amend1", level: "summary", attempts: 1 } }), [{ custom_id: "x", result: ok('{"en":"E","es":"S"}') }]);
  assert.equal(d.parts[0].summary.status, "unchecked");
  assert.equal(d.parts[0].summary.text_hash, "h");
  assert.deepEqual(plan(d).map((s) => `${s.kind}-${s.level}`), ["c-summary", "s-simple"]);
  applyResults(d, batch({ x: { kind: "c", part: "amend1", level: "summary", attempts: 1 } }), [{ custom_id: "x", result: ok('{"ok":false,"problems":["adds history"]}') }]);
  assert.equal(d.parts[0].summary.status, "flagged");
  const [r] = plan(d);
  assert.deepEqual([r.kind, r.attempts], ["r", 2]);
  applyResults(d, batch({ x: r }), [{ custom_id: "x", result: ok('{"en":"E2","es":"S2"}') }]);
  applyResults(d, batch({ x: { kind: "c", part: "amend1", level: "summary", attempts: 2 } }), [{ custom_id: "x", result: ok('{"ok":false,"problems":["still"]}') }]);
  assert.equal(d.parts[0].summary.status, "held");
  assert.equal(shownSummary(d.parts[0]), null);
  // Parts in a batch not yet collected are left alone.
  d.batches = [{ id: "b2", items: { y: { part: "amend1", level: "simple" } } }];
  assert.deepEqual(plan(d), []);
});

test("cost estimate for the whole job stays under $1", () => {
  const e = estimate(data);
  assert.equal(e.requests, data.parts.length * 4);
  assert.ok(e.usd > 0.1 && e.usd < 1, String(e.usd));
});

import { publicData } from "../lib/constitution.js";
test("the served copy keeps the text and only summaries that may be shown", () => {
  const d = { title: "T", parts: [
    { id: "a", text_hash: "h", blocks: [{ text: "x" }], summary: { en: "E", es: "S", status: "passed", text_hash: "h", check_notes: null }, simple: { en: "e", es: "s", status: "held", text_hash: "h" } },
    { id: "b", text_hash: "h", blocks: [{ text: "y" }], summary: { en: "E", es: "S", status: "flagged", text_hash: "h" }, simple: { en: "e", es: "s", status: "passed", text_hash: "h" } },
  ], batches: [{ id: "x" }] };
  const p = publicData(d);
  assert.equal(p.batches, undefined);
  assert.deepEqual(p.parts[0], { id: "a", blocks: [{ text: "x" }], summary: { en: "E", es: "S" } });
  assert.deepEqual(p.parts[1], { id: "b", blocks: [{ text: "y" }] });
  assert.equal(publicData(data).parts.length, 52);
});
