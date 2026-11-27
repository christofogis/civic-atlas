import { test } from "node:test";
import assert from "node:assert/strict";
import { setCurrentLang } from "../src/lib/lang.js";
import { date, easternDay } from "../src/lib/format.js";

test("roll-call timestamps read as the day in Washington, whatever the reader's time zone", () => {
  setCurrentLang("en");
  // House roll 25 of 2023: 9:23 p.m. Eastern on Jan 9, stored as Jan 10 in UTC.
  assert.equal(easternDay("2023-01-10T02:23:00+00:00"), "2023-01-09");
  assert.equal(date("2023-01-10T02:23:00+00:00"), "Jan 9, 2023");
  // A 1:22 a.m. Eastern vote stays on its own day (not the evening before, as on Pacific time).
  assert.equal(easternDay("2023-06-02T05:22:00+00:00"), "2023-06-02");
  assert.equal(date("2023-06-02T05:22:00+00:00"), "Jun 2, 2023");
  // Plain dates are shown as written.
  assert.equal(date("2024-11-05"), "Nov 5, 2024");
  assert.equal(easternDay(null), "");
});
