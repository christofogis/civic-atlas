import { test } from "node:test";
import assert from "node:assert/strict";
import { POLICY_AREAS } from "../src/lib/policyAreas.js";
import { ISSUES, MORE_TOPICS, MAX_PICKS, cleanPicks, togglePick, readPicks, savePicks, windowStart,
  movedFilter, latestStep, summaryLine, STORAGE_KEY } from "../src/lib/issues.js";

test("every policy area maps to an issue or appears under More topics, exactly once", () => {
  const fromIssues = ISSUES.flatMap((i) => i.areas);
  for (const a of fromIssues) assert.ok(POLICY_AREAS.includes(a), `not an official policy area: ${a}`);
  assert.equal(new Set(fromIssues).size, fromIssues.length, "an area is in two issues");
  for (const a of POLICY_AREAS) {
    const n = fromIssues.filter((x) => x === a).length + MORE_TOPICS.filter((x) => x === a).length;
    assert.equal(n, 1, a);
  }
});

test("issues have unique ids and both languages", () => {
  assert.equal(new Set(ISSUES.map((i) => i.id)).size, ISSUES.length);
  for (const i of ISSUES) { assert.ok(i.en && i.es && i.areas.length, i.id); }
});

test("picks: toggle, max 3, unknown ids dropped", () => {
  let p = [];
  for (const id of ["health", "taxes", "housing", "jobs"]) p = togglePick(p, id);
  assert.deepEqual(p, ["health", "taxes", "housing"]);
  assert.equal(p.length, MAX_PICKS);
  assert.deepEqual(togglePick(p, "taxes"), ["health", "housing"]);
  assert.deepEqual(togglePick(p, "nope"), p);
  assert.deepEqual(cleanPicks(["health", "health", "x", "taxes", "jobs", "housing"]), ["health", "taxes", "jobs"]);
  assert.deepEqual(cleanPicks("health"), []);
});

test("picks: stored on the device, and storage failures are harmless", () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  savePicks(["health", "taxes"], storage);
  assert.equal(mem.get(STORAGE_KEY), '["health","taxes"]');
  assert.deepEqual(readPicks(storage), ["health", "taxes"]);
  savePicks([], storage);
  assert.equal(mem.has(STORAGE_KEY), false);
  mem.set(STORAGE_KEY, "{not json");
  assert.deepEqual(readPicks(storage), []);
  const broken = { getItem() { throw new Error("off"); }, setItem() { throw new Error("off"); }, removeItem() { throw new Error("off"); } };
  assert.deepEqual(readPicks(broken), []);
  assert.doesNotThrow(() => savePicks(["health"], broken));
  assert.deepEqual(readPicks(undefined), []);
});

test("window and filters", () => {
  assert.equal(windowStart(new Date("2026-11-26T20:00:00Z")), "2026-10-28");
  assert.equal(windowStart(new Date("2026-03-01T00:00:00Z"), 1), "2026-03-01");
  assert.match(movedFilter("2026-10-28"), /^reported_date\.gte\.2026-10-28,.*became_law_date\.gte\.2026-10-28$/);
  assert.doesNotMatch(movedFilter("2026-10-28"), /introduced/);
  assert.equal(latestStep({ reported_date: "2026-10-01", passed_house_date: "2026-11-02", became_law_date: null }), "2026-11-02");
  assert.equal(latestStep({}), null);
});

test("summary line, singular and plural", () => {
  assert.equal(summaryLine({ bills: 3, votes: 5, laws: 1 }).en, "In the last 30 days: 3 bills moved, 5 roll-call votes, 1 became law.");
  assert.equal(summaryLine({ bills: 1, votes: 1, laws: 0 }).es, "En los últimos 30 días: 1 proyecto avanzó, 1 votación nominal, 0 se convirtieron en ley.");
  assert.equal(summaryLine({}).en, "Nothing recorded in the last 30 days.");
});
