import test from "node:test";
import assert from "node:assert/strict";
import {
  SIMPLE_SYSTEM, SIMPLE_CHECK_SYSTEM, parseSimple, sentences, simpleCheckPrompt, simpleRewritePrompt,
  simpleOrder, planSimple, simpleParams, simpleCheckParams, estimate,
} from "../scripts/ingest/bill-simple-summaries.mjs";
import { sourceHash, billKey } from "../scripts/ingest/bill-summaries.mjs";
import { quizCandidates, QUIZ_CANDIDATES } from "../src/lib/quizPick.js";

const LONG = "The bill requires the Department of Agriculture to do several things. ".repeat(6);
const bill = (over = {}) => ({ congress: 119, bill_type: "hr", number: 1, title: "To provide for X.", short_title: "X Act", crs_summary: LONG, ...over });

test("instructions: simple, no analogies, neutral, same for every party, low effort on both requests", () => {
  assert.match(SIMPLE_SYSTEM, /5th-grade/);
  assert.match(SIMPLE_SYSTEM, /No analogies, comparisons, metaphors, or examples/);
  assert.match(SIMPLE_SYSTEM, /Never describe purpose, intent/);
  assert.match(SIMPLE_CHECK_SYSTEM, /may leave out minor details/);
  assert.match(SIMPLE_CHECK_SYSTEM, /analogy, comparison/);
  assert.match(SIMPLE_CHECK_SYSTEM, /"must" where the CRS summary says "may"/);
  assert.doesNotMatch(SIMPLE_SYSTEM + SIMPLE_CHECK_SYSTEM, /Republican|Democrat/);
  assert.equal(simpleParams("x").output_config.effort, "low");
  assert.equal(simpleCheckParams("x").output_config.effort, "low");
  assert.equal(simpleCheckParams("x").system, SIMPLE_CHECK_SYSTEM);
});

test("check and rewrite prompts carry the CRS summary and both languages", () => {
  const c = simpleCheckPrompt(bill(), { text_en: "It does X.", text_es: "Hace X." });
  assert.match(c, /CRS summary:\nThe bill requires/);
  assert.match(c, /AI explanation \(English\):\nIt does X\.\n\nAI explanation \(Spanish\):\nHace X\./);
  assert.match(simpleRewritePrompt(bill(), ["a — b"]), /problems in an earlier explanation[\s\S]*- a — b$/);
});

test("sentences: initials and titles don't end a sentence", () => {
  assert.equal(sentences("The U.S. Postal Service must do X. It may do Y."), 2);
  assert.equal(sentences("Sets a date. ¿Qué? Ends it."), 3);
  assert.equal(sentences("Sen. Smith must report."), 1);
});

test("parseSimple: both languages, short enough, whitespace tidied", () => {
  assert.deepEqual(parseSimple('Sure:\n{"text_en":" It sets  a date. ","text_es":"Fija una fecha."}'), { text_en: "It sets a date.", text_es: "Fija una fecha." });
  assert.equal(parseSimple('{"text_en":"A.","text_es":""}'), null);
  assert.equal(parseSimple("no json"), null);
  assert.equal(parseSimple(JSON.stringify({ text_en: "One. Two. Three. Four. Five.", text_es: "Uno." })), null);
  assert.equal(parseSimple(JSON.stringify({ text_en: "word ".repeat(80), text_es: "x" })), null);
});

test("order: quiz bills first, then the rest newest first, only with a published plain summary", () => {
  const plain = new Map([["119|hr|1", {}], ["119|hr|2", {}], ["119|s|3", {}]]);
  const meta = new Map([["119|hr|1", { latest_action_date: "2026-01-01" }], ["119|hr|2", { latest_action_date: "2026-05-01" }], ["119|s|3", { latest_action_date: "2026-03-01" }]]);
  assert.deepEqual(simpleOrder({ quiz: ["119|s|3", "119|hr|9"], plain, meta }), ["119|s|3", "119|hr|2", "119|hr|1"]);
});

test("plan: needs a current published plain summary; limit; changed source; checks and rewrites", () => {
  const b1 = bill(), b2 = bill({ number: 2 }), b3 = bill({ number: 3 }), b4 = bill({ number: 4 }), b5 = bill({ number: 5 });
  const h = sourceHash(LONG);
  const bills = new Map([b1, b2, b3, b4, b5].map((b) => [billKey(b), b]));
  const keys = [...bills.keys(), "119|hr|6"];
  const plain = new Map([
    ["119|hr|1", { source_hash: h }], ["119|hr|2", { source_hash: "old" }], ["119|hr|3", { source_hash: h }],
    ["119|hr|4", { source_hash: h }], ["119|hr|5", { source_hash: h }],
  ]);
  const stored = new Map([
    ["119|hr|3", { source_hash: h, status: "unchecked", attempts: 1 }],
    ["119|hr|4", { source_hash: h, status: "flagged", attempts: 1, check_notes: ["x"] }],
    ["119|hr|5", { source_hash: "older", status: "passed", attempts: 1 }],
  ]);
  const p = planSimple({ keys, bills, plain, stored, limit: 1 });
  assert.deepEqual(p.summarize.map((w) => [w.bill.number, w.reason]), [[1, "new"], [5, "changed"]]);
  assert.deepEqual(p.check.map((w) => w.bill.number), [3]);
  assert.deepEqual(p.rewrite.map((w) => w.bill.number), [4]);
  assert.deepEqual(p.skipped, { noPlain: 1, plainOutdated: 1, tooLong: 0 });
  // In flight: left alone. Limit 0: no new ones, but changed sources still go.
  const q = planSimple({ keys, bills, plain, stored, limit: 0, inFlight: new Set(["119|hr|3"]) });
  assert.deepEqual(q.summarize.map((w) => w.bill.number), [5]);
  assert.equal(q.check.length, 0);
  // Passed and current: nothing to do unless --redo.
  const passed = new Map([["119|hr|1", { source_hash: h, status: "passed" }]]);
  assert.equal(planSimple({ keys: ["119|hr|1"], bills, plain, stored: passed }).summarize.length, 0);
  assert.equal(planSimple({ keys: ["119|hr|1"], bills, plain, stored: passed, redo: true }).summarize[0].reason, "redo");
});

test("quiz rule: contested final passage, newest first, one per bill with each chamber's latest", () => {
  const v = (id, over) => ({ vote_id: id, chamber: "house", question: "On Passage", description: "", bill_congress: 119, bill_type: "hr", bill_number: 1, yea_total: 220, nay_total: 200, ...over });
  const c = quizCandidates([
    v("a"), v("b", { chamber: "senate", question: "On Passage of the Bill" }), v("c"),
    v("d", { bill_number: 2, yea_total: 400, nay_total: 5 }),            // not contested
    v("e", { bill_number: 3, question: "On Motion to Recommit" }),        // not final passage
    v("f", { bill_number: 4, bill_type: null }),
  ]);
  assert.deepEqual(c.map((x) => x.key), ["119-hr-1"]);
  assert.equal(c[0].votes.house.vote_id, "a");
  assert.equal(c[0].votes.senate.vote_id, "b");
  const many = Array.from({ length: 60 }, (_, i) => v(String(i), { bill_number: i + 1 }));
  assert.equal(quizCandidates(many).length, QUIZ_CANDIDATES);
});

test("estimate grows with the number of bills", () => {
  const a = estimate(100, 100_000), b = estimate(200, 200_000);
  assert.ok(b.usd > a.usd && a.usd > 0.5 && a.usd < 2);
});
