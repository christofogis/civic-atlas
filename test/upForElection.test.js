import test from "node:test";
import assert from "node:assert/strict";
import { generalElectionDate, nextElectionYear, onBallot, senateClassFor, isGubernatorialYear, yearOfLabel } from "../lib/upForElection.js";

test("general election dates", () => {
  assert.equal(generalElectionDate(2026), "2026-11-03");
  assert.equal(generalElectionDate(2028), "2028-11-07");
  assert.equal(generalElectionDate(2030), "2030-11-05");
  assert.equal(generalElectionDate(2032), "2032-11-02");
});

test("next election year", () => {
  assert.equal(nextElectionYear("2026-11-03"), 2026);
  assert.equal(nextElectionYear("2026-11-26"), 2028);
  assert.equal(nextElectionYear("2027-05-01"), 2028);
});

test("seats on the ballot by term end", () => {
  assert.equal(onBallot({ end_date: "2027-01-03" }, 2026), true);   // House, class 2
  assert.equal(onBallot({ end_date: "2026-12-15" }, 2026), true);   // appointee until a special election
  assert.equal(onBallot({ end_date: "2029-01-03" }, 2026), false);
  assert.equal(onBallot({ end_date: "2029-01-03" }, 2028), true);   // class 3
  assert.equal(onBallot({ end_date: "2031-01-03" }, 2030), true);   // class 1
});

test("Senate class and California cycles", () => {
  assert.deepEqual([2026, 2028, 2030, 2032].map(senateClassFor), [2, 3, 1, 2]);
  assert.equal(isGubernatorialYear(2030), true);
  assert.equal(isGubernatorialYear(2028), false);
  assert.equal(yearOfLabel("November 2028"), 2028);
});

import { localOnBallot } from "../lib/upForElection.js";
test("local terms ending in early January", () => {
  assert.equal(localOnBallot("2027-01-04", 2026), true);
  assert.equal(localOnBallot("2029-01-01", 2028), true);
  assert.equal(localOnBallot("2029-01-01", 2026), false);
});

import { ballotYearFor } from "../lib/upForElection.js";
test("ballot year for a term", () => {
  assert.equal(ballotYearFor({ end_date: "2029-01-03" }), 2028);
  assert.equal(ballotYearFor({ end_date: "2027-01-03" }), 2026);
  assert.equal(ballotYearFor({ end_date: "2026-12-15" }), 2026);
  assert.equal(ballotYearFor({ end_date: "2031-01-03" }), 2030);
});
