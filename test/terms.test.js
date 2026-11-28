import test from "node:test";
import assert from "node:assert/strict";
import { findTerms, markTerms, markBlock } from "../src/lib/terms.js";
import { GLOSSARY } from "../src/lib/glossary.js";

const joined = (parts) => parts.map((p) => p.text).join("");
const ids = (parts) => parts.filter((p) => p.id).map((p) => `${p.id}:${p.text}`);

test("the text is never changed, only cut", () => {
  const s = "On Motion to Suspend the Rules and Pass, as Amended; cloture on the joint resolution.";
  assert.equal(joined(markTerms(s)), s);
  assert.equal(joined(markTerms("")), "");
  assert.equal(joined(markTerms("Nothing here.")), "Nothing here.");
});

test("finds legislative terms as whole words, case-insensitive", () => {
  assert.deepEqual(ids(markTerms("On Motion to Suspend the Rules and Pass")), ["suspension:Suspend the Rules"]);
  assert.deepEqual(ids(markTerms("Makes appropriations for the Department of Defense.")), ["appropriations:appropriations"]);
  assert.deepEqual(ids(markTerms("On the Cloture Motion")), ["cloture:Cloture"]);
  assert.deepEqual(ids(markTerms("misappropriations and filibustering")), ["filibuster:filibustering"]);
  assert.deepEqual(ids(markTerms("On Agreeing to the Amendments en bloc")), ["en-bloc:en bloc"]);
});

test("longest match wins where terms overlap", () => {
  assert.deepEqual(ids(markTerms("Provides continuing appropriations through March.")), ["continuing-resolution:continuing appropriations"]);
  assert.deepEqual(ids(markTerms("the vote to override the veto")), ["veto:override the veto"]);
});

test("words with another everyday meaning aren't marked on their own", () => {
  assert.deepEqual(ids(markTerms("Individuals enrolled in Medicaid; a truth and reconciliation commission.")), []);
  assert.deepEqual(ids(markTerms("Sends the enrolled bill to the President.")), ["enrolled:enrolled bill"]);
});

test("first occurrence only, across a block", () => {
  assert.deepEqual(ids(markTerms("Cloture on cloture.")), ["cloture:Cloture"]);
  const [a, b] = markBlock(["Makes appropriations.", "More appropriations; a quorum."]);
  assert.deepEqual(ids(a), ["appropriations:appropriations"]);
  assert.deepEqual(ids(b), ["quorum:quorum"]);
});

test("Spanish text looks for Spanish words, accents included", () => {
  assert.deepEqual(ids(markTerms("Es una resolución conjunta sobre el quórum.", { lang: "es" })), ["joint-resolution:resolución conjunta", "quorum:quórum"]);
  assert.deepEqual(findTerms("resolución conjuntas", "es").length, 1);
  assert.deepEqual(findTerms("resoluciónes", "es"), []);
});

test("every marked term has both languages", () => {
  for (const [id, g] of Object.entries(GLOSSARY)) {
    if (!g.match && !g.match_es) continue;
    assert.ok(g.term && g.text && g.term_es && g.text_es, id);
  }
  for (const id of ["appropriations", "cloture", "en-bloc", "rescission", "reconciliation", "recommit", "suspension", "quorum",
    "joint-resolution", "concurrent-resolution", "continuing-resolution", "enrolled", "markup", "earmark", "filibuster", "veto"]) {
    assert.ok(GLOSSARY[id]?.match, id);
  }
});
