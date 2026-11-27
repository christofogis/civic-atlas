import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pageText, electionSections, compareSections, measureId, byElection, nextElection, electionNameEs } from "../lib/measures.js";

// Trimmed copies of the Secretary of State's pages as read through the probe on Nov 27, 2026.
const qualified = pageText(readFileSync(new URL("./fixtures/sos/qualified-2026-11-27.html", import.meta.url), "utf8"));
const eligible = pageText(readFileSync(new URL("./fixtures/sos/eligible-2026-11-27.html", import.meta.url), "utf8"));
const list = JSON.parse(readFileSync(new URL("../data/measures/ca-2028.json", import.meta.url), "utf8"));

test("every 2028 section is read, each with its election date", () => {
  const s = electionSections(qualified, 2028);
  assert.deepEqual(s.map((x) => [x.month, x.day, x.ids]), [[3, 7, ["sb-895"]], [11, 7, ["aca-7"]]]);
  assert.deepEqual(electionSections(eligible, 2028).map((x) => [x.month, x.day, x.ids]), [[11, null, ["1995"]]]);
  assert.equal(electionSections(qualified, 2026)[0].ids.includes("sb-895"), false); // other years stay separate
});

test("printed numbers map to our ids", () => {
  assert.equal(measureId("SB 895"), "sb-895");
  assert.equal(measureId("ACA 7"), "aca-7");
  assert.equal(measureId("1995. (25-0018"), "1995");
});

test("our list matches both pages, including SB 895 on March 7", () => {
  assert.deepEqual(compareSections(electionSections(qualified, 2028), list.measures, "qualified"), []);
  assert.deepEqual(compareSections(electionSections(eligible, 2028), list.measures, "eligible"), []);
  const moved = list.measures.map((m) => (m.id === "sb-895" ? { ...m, election: "2028-11-07" } : m));
  assert.match(compareSections(electionSections(qualified, 2028), moved, "qualified")[0], /sb-895 under "March 7, 2028/);
  const missing = list.measures.filter((m) => m.id !== "sb-895");
  assert.match(compareSections(electionSections(qualified, 2028), missing, "qualified")[0], /isn't in our list/);
});

test("measures grouped by election, in date order", () => {
  const g = byElection(list);
  assert.deepEqual(g.map((e) => [e.date, e.measures.map((m) => m.id)]), [["2028-03-07", ["sb-895"]], ["2028-11-07", ["aca-7", "1995"]]]);
  assert.equal(nextElection(list, "2026-11-27").date, "2028-03-07");
  assert.equal(nextElection(list, "2028-03-08").date, "2028-11-07");
  assert.equal(nextElection(list, "2028-11-08"), null);
});

test("election names in Spanish follow the English kind", () => {
  const f = (d) => d;
  assert.equal(electionNameEs({ date: "2028-03-07", name: "March 7, 2028, Statewide Primary Election" }, f), "Elección primaria estatal del 2028-03-07");
  assert.equal(electionNameEs({ date: "2028-11-07", name: "November 7, 2028, Statewide General Election" }, f), "Elección general estatal del 2028-11-07");
});
