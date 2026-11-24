import { test } from "node:test";
import assert from "node:assert/strict";
import { rss, ics } from "../lib/feeds.js";

test("rss escapes text and formats dates", () => {
  const x = rss({ title: "A & B", link: "https://x", description: "d", items: [
    { title: "Voted Yea on <H.R. 1>", link: "https://x/bill/119/hr/1", guid: "g1", date: "2025-07-03" },
  ] });
  assert.match(x, /<title>A &amp; B<\/title>/);
  assert.match(x, /Voted Yea on &lt;H.R. 1&gt;/);
  assert.match(x, /<pubDate>Thu, 03 Jul 2025 12:00:00 GMT<\/pubDate>/);
});

test("ics: timed, all-day and week-long events", () => {
  const out = ics({
    name: "Test", origin: "https://site", stamp: new Date("2026-11-24T00:00:00Z"),
    events: [
      { event_id: "senate-meeting-1", chamber: "senate", kind: "hearing", event_date: "2026-12-01", event_time: "2:30 PM", week_of: false,
        committee_name: "Finance", title: "Hearings to examine, things; and more", location: "SD-215", status: "Scheduled", source_url: "https://senate" },
      { event_id: "house-floor-1", chamber: "house", kind: "floor", event_date: "2026-11-30", event_time: null, week_of: true,
        committee_name: null, title: "H.R. 1: Bill", location: null, status: null, source_url: "https://house" },
    ],
  });
  assert.match(out, /DTSTART;TZID=America\/New_York:20261201T143000/);
  assert.match(out, /DTEND;TZID=America\/New_York:20261201T153000/);
  assert.match(out, /Hearings to examine\\, things\\; and more/);
  assert.match(out, /DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261205/);
  assert.ok(out.split("\r\n").every((l) => l.length <= 75));
  assert.ok(out.endsWith("END:VCALENDAR\r\n"));
});
