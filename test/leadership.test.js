import { test } from "node:test";
import assert from "node:assert/strict";
import { isCurrentRole, currentRoles, ballotTally, speakerElections, isChamberPost, todayEastern, isSpeakerElection, tallyByVote } from "../lib/leadership.js";
import { mapLeadership } from "../scripts/ingest/members.mjs";

const role = (bioguide_id, chamber, title, start_date, end_date = null) => ({ bioguide_id, chamber, title, start_date, end_date });

test("a role is current from its start until the day before its end", () => {
  const r = role("A", "house", "House Majority Whip", "2025-01-03", "2027-01-03");
  assert.equal(isCurrentRole(r, "2025-01-02"), false);
  assert.equal(isCurrentRole(r, "2025-01-03"), true);
  assert.equal(isCurrentRole(r, "2027-01-02"), true);
  assert.equal(isCurrentRole(r, "2027-01-03"), false);
  assert.equal(isCurrentRole(role("A", "house", "X", "2025-01-03"), "2030-01-01"), true); // no end listed
  assert.equal(isCurrentRole({ title: "X" }, "2025-01-01"), false);
});

test("current roles: chamber posts first in a fixed order, then other titles alphabetically", () => {
  const rows = [
    role("C", "house", "House Republican Conference Chair", "2025-01-03"),
    role("B", "house", "House Minority Leader", "2025-01-03"),
    role("A", "house", "Speaker of the House", "2025-01-03"),
    role("D", "house", "House Democratic Caucus Chair", "2025-01-03"),
    role("E", "house", "Speaker of the House", "2023-10-25", "2025-01-03"),
  ];
  const now = currentRoles(rows, "2026-11-26");
  assert.deepEqual(now.map((r) => r.bioguide_id), ["A", "B", "D", "C"]);
  assert.deepEqual(currentRoles(rows, "2024-06-01").map((r) => r.bioguide_id), ["E"]);
  assert.deepEqual(currentRoles(rows, "2026-11-26", "B").map((r) => r.title), ["House Minority Leader"]);
  assert.equal(isChamberPost(rows[2]), true);
  assert.equal(isChamberPost(rows[0]), false);
});

test("today is the date in Washington", () => {
  assert.equal(todayEastern(new Date("2027-01-03T03:00:00Z")), "2027-01-02");
});

const t = (vote_id, position, votes, position_category = "other") => ({ vote_id, position, position_category, votes });

test("ballot tally: majority of votes cast for a named candidate; Present and Not Voting excluded", () => {
  // 119th Congress, roll 2: Johnson (LA) 218, Jeffries 215, Emmer 1 -> 434 cast, 218 needed.
  const a = ballotTally([t("v", "Jeffries", 215), t("v", "Emmer", 1), t("v", "Johnson (LA)", 218)]);
  assert.equal(a.cast, 434);
  assert.equal(a.needed, 218);
  assert.equal(a.majority, "Johnson (LA)");
  assert.deepEqual(a.candidates.map((c) => c.position), ["Johnson (LA)", "Jeffries", "Emmer"]);
  // 118th, roll 20: McCarthy 216, Jeffries 212, Present 6 -> 428 cast, 215 needed.
  const b = ballotTally([t("v", "McCarthy", 216), t("v", "Jeffries", 212), t("v", "Present", 6, "present")]);
  assert.equal(b.needed, 215);
  assert.equal(b.majority, "McCarthy");
  assert.deepEqual(b.others.map((o) => o.position), ["Present"]);
  // 118th, roll 2: most votes but no majority.
  const c = ballotTally([t("v", "Jeffries", 212), t("v", "McCarthy", 203), t("v", "Biggs", 10), t("v", "Jordan", 6), t("v", "Not Voting", 1, "not_voting")]);
  assert.equal(c.needed, 216);
  assert.equal(c.majority, null);
  assert.deepEqual(ballotTally([]), { candidates: [], others: [], cast: 0, needed: null, majority: null });
});

test("speaker elections: ballots numbered within each election, newest election first", () => {
  const v = (id, congress, at) => ({ vote_id: id, congress, voted_at: at });
  const votes = [
    v("h119-2", 119, "2025-01-03T19:33:00Z"),
    v("h118-3", 118, "2023-01-03T20:16:00Z"),
    v("h118-2", 118, "2023-01-03T18:39:00Z"),
    v("h118-15", 118, "2023-01-06T18:46:00Z"),
    v("h118-521", 118, "2023-10-17T17:49:00Z"),
    v("h118-527", 118, "2023-10-25T17:50:00Z"),
  ];
  const tallies = new Map([
    ["h118-2", [t("", "Jeffries", 212), t("", "McCarthy", 203), t("", "Biggs", 19)]],
    ["h118-3", [t("", "Jeffries", 212), t("", "McCarthy", 203), t("", "Jordan", 19)]],
    ["h118-15", [t("", "McCarthy", 216), t("", "Jeffries", 212)]],
    ["h118-521", [t("", "Jeffries", 212), t("", "Jordan", 200), t("", "Scalise", 7), t("", "McCarthy", 6), t("", "Zeldin", 3), t("", "Emmer", 4)]],
    ["h118-527", [t("", "Johnson (LA)", 220), t("", "Jeffries", 209)]],
    ["h119-2", [t("", "Johnson (LA)", 218), t("", "Jeffries", 215), t("", "Emmer", 1)]],
  ]);
  const e = speakerElections(votes, tallies);
  assert.equal(e.length, 3);
  assert.deepEqual(e.map((x) => x.ballots.length), [1, 2, 3]);
  assert.deepEqual(e[2].ballots.map((b) => [b.vote_id, b.ballot]), [["h118-2", 1], ["h118-3", 2], ["h118-15", 3]]);
  assert.equal(e[2].elected.name, "McCarthy");
  assert.equal(e[2].elected.ballot, 3);
  assert.equal(e[1].elected.name, "Johnson (LA)");
  assert.equal(e[0].congress, 119);
  assert.equal(e[2].first, "2023-01-03T18:39:00Z");
  // A series with no majority yet stays one open election.
  const open = speakerElections(votes.slice(1, 3), tallies);
  assert.equal(open.length, 1);
  assert.equal(open[0].elected, null);
});

test("leadership roles from the legislators file: verbatim, deduplicated, open end kept", () => {
  const rows = mapLeadership([
    { id: { bioguide: "J000299" }, leadership_roles: [
      { title: "Speaker of the House", chamber: "house", start: "2023-10-25", end: "2025-01-03" },
      { title: "Speaker of the House", chamber: "house", start: "2025-01-03" },
      { title: "Speaker of the House", chamber: "house", start: "2025-01-03" },
    ] },
    { id: { bioguide: "X" } },
    { id: { bioguide: "Y" }, leadership_roles: [{ title: "Odd", chamber: "joint", start: "2025-01-03" }] },
  ]);
  assert.deepEqual(rows, [
    { bioguide_id: "J000299", chamber: "house", title: "Speaker of the House", start_date: "2023-10-25", end_date: "2025-01-03" },
    { bioguide_id: "J000299", chamber: "house", title: "Speaker of the House", start_date: "2025-01-03", end_date: null },
  ]);
});

test("Speaker election questions are recognized as the Clerk words them", () => {
  assert.equal(isSpeakerElection("Election of the Speaker"), true);
  assert.equal(isSpeakerElection(" Election of the Speaker "), true);
  assert.equal(isSpeakerElection("On Passage"), false);
  assert.equal(isSpeakerElection(null), false);
});

test("tallies by vote: the Clerk's top name is not a majority unless it has more than half of named votes", () => {
  const rows = [
    { vote_id: "h1", position: "McCarthy", position_category: "other", votes: 203 },
    { vote_id: "h1", position: "Jeffries", position_category: "other", votes: 212 },
    { vote_id: "h1", position: "Biggs", position_category: "other", votes: 10 },
    { vote_id: "h1", position: "Present", position_category: "present", votes: 0 },
    { vote_id: "h2", position: "McCarthy", position_category: "other", votes: 216 },
    { vote_id: "h2", position: "Jeffries", position_category: "other", votes: 212 },
    { vote_id: "h2", position: "Present", position_category: "present", votes: 6 },
  ];
  const m = tallyByVote(rows);
  assert.equal(m.get("h1").majority, null); // top name (Jeffries, 212) of 425 cast; needs 213
  assert.equal(m.get("h1").needed, 213);
  assert.equal(m.get("h2").majority, "McCarthy"); // 216 of 428 named votes; Present not counted
  assert.equal(m.get("h2").cast, 428);
});
