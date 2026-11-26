import { test } from "node:test";
import assert from "node:assert/strict";
import { memberRaces, shareOn, pctText } from "../lib/electionResults.js";

const c = (name, fec_ids, votes, pct, extra = {}) => ({ name, party: "X", fec_ids, votes, pct, ...extra });
const doc2022 = {
  year: 2022, percent: "as printed", source: { title: "Federal Elections 2022" },
  races: [
    { state: "IN", office: "H", district: 2, date: "2022-11-08", special: false, term: "full", candidates: [c("Yakym", ["H2IN02295"], 125537, 64.59), c("Steury", ["H2IN02279"], 62955, 32.39)] },
    { state: "IN", office: "H", district: 2, date: "2022-11-08", special: true, term: "unexpired", candidates: [c("Yakym", ["H2IN02295"], 118997, 63.28)] },
    { state: "RI", office: "H", district: 1, date: "2023-11-07", special: true, term: null, candidates: [c("Amo", ["H4RI01265"], 1, 64.6)] },
    { state: "FL", office: "H", district: 5, date: "2022-11-08", special: false, term: null, candidates: [c("Rutherford", ["H6FL04105"], null, null, { unopposed: true })] },
  ],
};
const doc2024 = {
  year: 2024, percent: "calculated", source: { title: "Statistics 2024" },
  races: [
    { state: "IN", office: "H", district: 2, date: "2024-11-05", special: false, term: null, candidates: [c("Yakym", ["H2IN02295"], 1, 65.12)] },
    { state: "RI", office: "H", district: 1, date: "2023-11-07", special: true, term: null, candidates: [c("Amo (dup)", ["H4RI01265"], 1, 64.6)] },
  ],
};

test("memberRaces: by FEC ID, newest first, one entry per race", () => {
  const r = memberRaces(["H2IN02295", "unused"], [doc2024, doc2022]);
  assert.deepEqual(r.map((x) => [x.race.date, x.race.special, x.candidate.pct]), [["2024-11-05", false, 65.12], ["2022-11-08", false, 64.59], ["2022-11-08", true, 63.28]]);
  assert.equal(r[0].percent, "calculated");
  const amo = memberRaces(["H4RI01265"], [doc2024, doc2022]);
  assert.equal(amo.length, 1);
  assert.equal(amo[0].candidate.name, "Amo (dup)");
  assert.deepEqual(memberRaces([], [doc2022]), []);
  assert.deepEqual(memberRaces(null, [doc2022]), []);
});

test("shareOn: the full-term race that day, in that chamber", () => {
  assert.deepEqual(shareOn(["H2IN02295"], doc2022, "2022-11-08", "H"), { pct: 64.59, votes: 125537, unopposed: false, special: false });
  assert.equal(shareOn(["H2IN02295"], doc2022, "2022-11-08", "S"), null);
  assert.equal(shareOn(["H4RI01265"], doc2022, "2022-11-08", "H"), null);
  assert.deepEqual(shareOn(["H6FL04105"], doc2022, "2022-11-08", "H"), { pct: null, votes: null, unopposed: true, special: false });
  assert.equal(shareOn(["H2IN02295"], null, "2022-11-08", "H"), null);
});

test("pctText", () => {
  assert.equal(pctText(52.34), "52.3%");
  assert.equal(pctText(100), "100.0%");
  assert.equal(pctText(0.04), "0.0%");
  assert.equal(pctText(null), "");
});
