import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleDates, holidays, listedDates } from "../lib/localMeetings.js";

test("third Monday, moved to Tuesday on a holiday", () => {
  const r = ruleDates({ nth: 3, weekday: 1 }, "2026-11-24", 4);
  assert.deepEqual(r.map((x) => x.date), ["2026-12-21", "2027-01-19", "2027-02-16", "2027-03-15"]);
  assert.equal(r[1].moved, true);
  assert.equal(r[0].moved, false);
});

test("holidays", () => {
  const h = holidays(2027);
  assert.ok(h.has("2027-01-18") && h.has("2027-02-15") && h.has("2027-05-31") && h.has("2027-09-06"));
});

test("listed dates from today", () => {
  assert.deepEqual(listedDates(["2026-11-17", "2026-12-01", "2026-12-15"], "2026-11-24").map((d) => d.date), ["2026-12-01", "2026-12-15"]);
});
