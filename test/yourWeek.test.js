import { test } from "node:test";
import assert from "node:assert/strict";
import { clock, weekIcs } from "../lib/yourWeek.js";

test("clock reads both time styles", () => {
  assert.deepEqual(clock("2:00 PM"), [14, 0]);
  assert.deepEqual(clock("12:15 PM"), [12, 15]);
  assert.deepEqual(clock("18:00"), [18, 0]);
  assert.equal(clock(null), null);
});

test("calendar feed: timed and all-day events, linked back to the site", () => {
  const out = weekIcs({ name: "Test", origin: "https://example.org", stamp: new Date("2026-11-25T00:00:00Z"), items: [
    { key: "bos-2026-12-01", date: "2026-12-01", time: "09:30", tz: "America/Los_Angeles", level: "county", text: "Board meeting, 41 items", to: "/local/ca-orange#agenda", url: "https://board.oc.gov" },
    { key: "c120", date: "2027-01-03", time: null, tz: "America/New_York", level: "congress", text: "The 120th Congress begins", to: "/week", url: null },
  ] });
  assert.match(out, /DTSTART;TZID=America\/Los_Angeles:20261201T093000/);
  assert.match(out, /DTSTART;VALUE=DATE:20270103\r\nDTEND;VALUE=DATE:20270104/);
  assert.match(out, /SUMMARY:Board meeting\\, 41 items/);
  assert.match(out, /URL:https:\/\/example.org\/local\/ca-orange#agenda/);
  assert.ok(out.startsWith("BEGIN:VCALENDAR") && out.trimEnd().endsWith("END:VCALENDAR"));
});
