import test from "node:test";
import assert from "node:assert/strict";
import { parseReply, userPrompt, SYSTEM } from "../scripts/ingest/section-summaries.mjs";

test("parseReply takes the JSON object and needs both languages", () => {
  assert.deepEqual(parseReply('{"en":"Sets a date.","es":"Fija una fecha."}'), { en: "Sets a date.", es: "Fija una fecha." });
  assert.deepEqual(parseReply('Here it is:\n{"en":" A ","es":"B"}'), { en: "A", es: "B" });
  assert.equal(parseReply('{"en":"A"}'), null);
  assert.equal(parseReply("not json"), null);
});

test("prompt names the bill, version and location, and is the same for every bill", () => {
  const p = userPrompt({ congress: 119, bill_type: "hr", number: 1, title: "T", short_title: "Short" },
    { version_name: "Enrolled Bill" }, { path: ["TITLE I"], header: "Definitions", text: "In this Act..." });
  assert.match(p, /^Bill: H\.R\. 1, 119th Congress — Short/);
  assert.match(p, /Location in the bill: TITLE I/);
  assert.match(p, /Section text:\nIn this Act/);
  assert.doesNotMatch(SYSTEM, /Republican|Democrat/);
});

import { parseCheck, checkPrompt, rewritePrompt, CHECK_SYSTEM } from "../scripts/ingest/section-summaries.mjs";

test("parseCheck: ok only with no problems listed", () => {
  assert.deepEqual(parseCheck('{"ok":true,"problems":[]}'), { ok: true, problems: [] });
  assert.deepEqual(parseCheck('{"ok":true,"problems":["x"]}'), { ok: false, problems: ["x"] });
  assert.equal(parseCheck('{"problems":[]}'), null);
});

test("check and rewrite prompts carry the text, the summary and the problems", () => {
  const bill = { congress: 119, bill_type: "s", number: 2, title: "T" };
  const s = { path: [], header: "H", text: "The Secretary shall..." };
  assert.match(checkPrompt(bill, { version_name: "Enrolled Bill" }, s, { en: "E", es: "S" }), /Section text:\nThe Secretary shall[\s\S]*Summary \(English\):\nE[\s\S]*Summary \(Spanish\):\nS/);
  assert.match(rewritePrompt(bill, { version_name: "Enrolled Bill" }, s, ["says lenders"]), /- says lenders$/);
  assert.match(CHECK_SYSTEM, /Leaving provisions out is allowed/);
});
