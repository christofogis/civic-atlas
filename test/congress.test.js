import { test } from "node:test";
import assert from "node:assert/strict";
import { congressOn, congressYears } from "../lib/congress.js";

test("Congress boundaries fall on Jan 3", () => {
  assert.equal(congressOn("2025-01-02"), 118);
  assert.equal(congressOn("2025-01-03"), 119);
  assert.equal(congressOn("2026-11-24"), 119);
  assert.equal(congressOn("2026-12-31"), 119);
  assert.equal(congressOn("2027-01-02"), 119);
  assert.equal(congressOn("2027-01-03"), 120);
  assert.equal(congressOn("2028-06-01"), 120);
  assert.equal(congressOn("2023-01-03"), 118);
});

test("uses Eastern time for Date objects", () => {
  // 2027-01-03 02:00 UTC is still Jan 2 in Washington.
  assert.equal(congressOn(new Date("2027-01-03T02:00:00Z")), 119);
  assert.equal(congressOn(new Date("2027-01-03T15:00:00Z")), 120);
});

test("years", () => {
  assert.equal(congressYears(119), "2025–2026");
  assert.equal(congressYears(120), "2027–2028");
});
