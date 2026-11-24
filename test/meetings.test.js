import { test } from "node:test";
import assert from "node:assert/strict";
import { committeeId, parseMeeting, statementFor } from "../lib/meetings.js";

test("committee codes", () => {
  assert.equal(committeeId("hshm00"), "HSHM");
  assert.equal(committeeId("ssbk12"), "SSBK12");
  assert.equal(committeeId("bogus"), null);
});

const house = {
  chamber: "House", congress: 119, eventId: "118927", date: "2026-02-24T15:00:00Z", type: "Hearing", meetingStatus: "Scheduled",
  title: "Before the Whistle", location: { building: "Cannon House Office Building", room: "310" },
  committees: [{ systemCode: "hshm00" }, { systemCode: "hshm09" }],
  hearingTranscript: [{ jacketNumber: 63779 }],
  videos: [{ url: "https://www.youtube.com/watch?v=x" }],
  meetingDocuments: [{ documentType: "Hearing: Witness List", url: "https://www.congress.gov/w.pdf" }],
  witnesses: [{ name: "Mr. Mike Sena", organization: "NFCA", position: "President" }, { name: "Dr. Ana de la Cruz Jr.", organization: "X" }],
  witnessDocuments: [
    { documentType: "Witness Statement", url: "https://www.congress.gov/119/meeting/house/118927/witnesses/HHRG-119-HM00-Wstate-SenaM-20260224.pdf" },
    { documentType: "Witness Biography", url: "https://www.congress.gov/119/meeting/house/118927/witnesses/HHRG-119-HM00-Bio-SenaM-20260224.pdf" },
    { documentType: "Witness Statement", url: "https://www.congress.gov/119/meeting/house/118927/witnesses/HHRG-119-HM00-Wstate-CruzA-20260224.pdf" },
  ],
  relatedItems: { bills: [{ congress: 119, type: "HR", number: "1" }] },
};

test("house meeting", () => {
  const m = parseMeeting(house);
  assert.equal(m.chamber, "house");
  assert.deepEqual(m.committee_ids, ["HSHM", "HSHM09"]);
  assert.equal(m.location, "Cannon House Office Building, 310");
  assert.deepEqual(m.bill_refs, ["119-hr-1"]);
  assert.equal(m.statements.length, 2);
  assert.equal(m.source_url, "https://www.congress.gov/event/119th-Congress/house-event/118927");
  assert.equal(m.has_transcript, true);
});

test("senate nominations and no witnesses", () => {
  const m = parseMeeting({ chamber: "Senate", congress: 119, eventId: "338901", title: "Business meeting", committees: [{ systemCode: "ssra00" }],
    relatedItems: { nominations: [{ number: 806, part: "10" }, { number: 806, part: "10" }] } });
  assert.deepEqual(m.nomination_refs, ["PN806-10"]);
  assert.deepEqual(m.witnesses, []);
  assert.equal(m.has_transcript, false);
});

test("statement matching by last name", () => {
  const m = parseMeeting(house);
  assert.match(statementFor(m.witnesses[0], m.statements), /SenaM/);
  assert.match(statementFor(m.witnesses[1], m.statements), /CruzA/);
  assert.equal(statementFor({ name: "Ms. Jane Doe" }, m.statements), null);
});

test("agenda-style titles", async () => {
  const { meetingHeading } = await import("../lib/meetings.js");
  assert.deepEqual(meetingHeading(": •\tH.R. 1031 (Rep. Tenney), “A Act”\r\n•\tH.R. 2323 (Rep. Gonzales), “B Act”", "Markup"),
    { heading: "Markup on 2 items", agenda: ["H.R. 1031 (Rep. Tenney), “A Act”", "H.R. 2323 (Rep. Gonzales), “B Act”"] });
  assert.deepEqual(meetingHeading("Legislative Hearing on 2 bills: \r\nH.R. 1 (Rep. A), “X”;\r\nS. 2 (Sen. B), “Y”", "Hearing"),
    { heading: "Legislative Hearing on 2 bills", agenda: ["H.R. 1 (Rep. A), “X”", "S. 2 (Sen. B), “Y”"] });
  assert.equal(meetingHeading("Oversight of X", "Hearing").heading, "Oversight of X");
});
