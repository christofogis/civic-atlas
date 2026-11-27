import test from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM, CHECK_SYSTEM, userPrompt, parseReply, checkPrompt, rewritePrompt, sourceHash, isShort,
  candidateKeys, planWork, billKey, SHORT_CHARS, MAX_CHARS,
} from "../scripts/ingest/bill-summaries.mjs";

const LONG = "The bill requires the Department of Agriculture to do several things. ".repeat(6);
const bill = (over = {}) => ({ congress: 119, bill_type: "hr", number: 1, title: "To provide for X.", short_title: "X Act", crs_summary: LONG, ...over });

test("prompt names the measure, carries the CRS summary, and is the same for every party", () => {
  const p = userPrompt(bill());
  assert.match(p, /^Measure: H\.R\. 1, 119th Congress — X Act/);
  assert.match(p, /Official title: To provide for X\./);
  assert.match(p, /CRS summary:\nThe bill requires/);
  assert.doesNotMatch(p, /is short/);
  assert.doesNotMatch(SYSTEM + CHECK_SYSTEM, /Republican|Democrat/);
  assert.match(SYSTEM, /25 words or fewer/);
  assert.match(CHECK_SYSTEM, /legal citations/);
});

test("a short CRS summary asks for a lead only", () => {
  const short = "Designates the facility of the U.S. Postal Service at 1 Main St. as the John Doe Post Office.";
  assert.ok(short.length < SHORT_CHARS && isShort(short));
  assert.match(userPrompt(bill({ crs_summary: short, short_title: null })), /is short: give the lead and an empty points list/);
  assert.doesNotMatch(userPrompt(bill({ crs_summary: short, short_title: null })), /Official title/);
});

test("parseReply: both languages, matching points, at most four, bullets stripped", () => {
  const r = parseReply('Here:\n{"lead_en":" Sets a date. ","points_en":["- A","B"],"lead_es":"Fija una fecha.","points_es":["A","B"]}');
  assert.deepEqual(r, { lead_en: "Sets a date.", lead_es: "Fija una fecha.", points_en: ["A", "B"], points_es: ["A", "B"] });
  assert.equal(parseReply('{"lead_en":"A","points_en":["x"],"lead_es":"B","points_es":[]}'), null);
  assert.equal(parseReply('{"lead_en":"A","lead_es":""}'), null);
  assert.equal(parseReply("not json"), null);
  assert.equal(parseReply(JSON.stringify({ lead_en: "word ".repeat(45), lead_es: "x" })), null);
  const five = ["1", "2", "3", "4", "5"];
  assert.equal(parseReply(JSON.stringify({ lead_en: "A", lead_es: "B", points_en: five, points_es: five })).points_en.length, 4);
  assert.deepEqual(parseReply('{"lead_en":"A","lead_es":"B"}'), { lead_en: "A", lead_es: "B", points_en: [], points_es: [] });
  assert.deepEqual(parseReply('{"lead_en":"A","points_en":["x"],"lead_es":"B","points_es":["y"]}', { short: true }).points_en, []);
});

test("check and rewrite prompts carry the CRS summary, the AI summary and the problems", () => {
  const s = { lead_en: "Sets a date.", points_en: ["P1"], lead_es: "Fija una fecha.", points_es: ["Q1"] };
  assert.match(checkPrompt(bill(), s), /CRS summary:\nThe bill[\s\S]*AI summary \(English\):\nSets a date\.\n- P1[\s\S]*AI summary \(Spanish\):\nFija una fecha\.\n- Q1$/);
  assert.match(rewritePrompt(bill(), ["says lenders"]), /- says lenders$/);
});

test("sourceHash is sha256 hex of the text as stored (matches Postgres sha256(convert_to(.., 'UTF8')))", () => {
  assert.equal(sourceHash("Requires é"), "5f5aedc4df1f2b44f9b3a1ae3cf71a192563d543e41cf576ff20bd9e3273d45c");
  assert.notEqual(sourceHash("a"), sourceHash("a "));
});

test("candidateKeys: voted bills, laws, /week bills and stored bills, newest first", () => {
  const today = "2026-11-27";
  const keys = candidateKeys({
    today,
    votes: [
      { bill_congress: 119, bill_type: "hr", bill_number: 5, voted_at: "2026-03-01T15:00:00Z" },
      { bill_congress: 119, bill_type: "hr", bill_number: 5, voted_at: "2026-06-01T15:00:00Z" },
      { bill_congress: null, bill_type: null, bill_number: null, voted_at: "2026-11-20T15:00:00Z" },   // nomination
    ],
    bills: [
      { congress: 118, bill_type: "s", number: 9, law_number: "Pub. L. 118-1", became_law_date: "2024-01-05" },
      { congress: 119, bill_type: "hres", number: 7, passed_house_date: "2026-11-20" },          // /week: voice vote
      { congress: 119, bill_type: "hr", number: 8, passed_house_date: "2026-01-02" },            // passed long ago, no roll call
      { congress: 118, bill_type: "hr", number: 2, latest_action_date: "2024-05-01" },
    ],
    events: [{ event_date: "2026-11-24", bill_refs: ["119-hr-77"] }, { event_date: "2026-09-01", bill_refs: ["119-hr-78"] }],
    storedKeys: ["118|hr|2"],
  });
  assert.deepEqual(keys, ["119|hr|77", "119|hres|7", "119|hr|5", "118|hr|2", "118|s|9"]);
});

test("planWork: new up to the limit, changed CRS text always redone, checks and rewrites go", () => {
  const b = (n, over) => bill({ number: n, ...over });
  const bills = new Map([b(1), b(2), b(3), b(4), b(5), b(6, { crs_summary: null }), b(7, { crs_summary: "x".repeat(MAX_CHARS + 1) }), b(8), b(9)].map((x) => [billKey(x), x]));
  const h = sourceHash(LONG);
  const stored = new Map([
    ["119|hr|1", { source_hash: h, status: "passed" }],
    ["119|hr|2", { source_hash: "old", status: "passed" }],
    ["119|hr|3", { source_hash: h, status: "unchecked", attempts: 1 }],
    ["119|hr|4", { source_hash: h, status: "flagged", attempts: 1 }],
    ["119|hr|5", { source_hash: h, status: "held", attempts: 2 }],
  ]);
  const keys = [...bills.keys()];
  const plan = planWork({ keys, bills, stored, inFlight: new Set(["119|hr|9"]), limit: 0 });
  assert.deepEqual(plan.summarize.map((w) => [w.bill.number, w.reason]), [[2, "changed"]]);
  assert.deepEqual(plan.check.map((w) => w.bill.number), [3]);
  assert.deepEqual(plan.rewrite.map((w) => w.bill.number), [4]);
  assert.deepEqual(plan.skipped, { noSummary: 1, tooLong: 1 });

  const more = planWork({ keys, bills, stored, limit: 5 });
  assert.deepEqual(more.summarize.map((w) => [w.bill.number, w.reason]), [[2, "changed"], [8, "new"], [9, "new"]]);

  const redo = planWork({ keys, bills, stored, limit: 2, redo: true });
  assert.deepEqual(redo.summarize.map((w) => [w.bill.number, w.reason]), [[1, "redo"], [2, "changed"], [3, "redo"]]);

  // Later stages of a run send no new summaries, only checks and rewrites.
  const later = planWork({ keys, bills, stored, limit: 5, newSummaries: false });
  assert.equal(later.summarize.length, 0);
  assert.equal(later.check.length, 1);
});
