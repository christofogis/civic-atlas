import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePas2, authorizedIndex, addRow, rankGivers } from "../scripts/ingest/fec-pas2.mjs";

// Real pas226 rows to Coons's principal committee C00475392 (In Our Hands, AIPAC PAC), as shown
// by the probe, plus an independent expenditure and a contribution to an unrelated committee.
const line = (cmte, tp, amt, other, cand = "S0DE00092", memo = "") =>
  [cmte, "N", "M4", "G2026", "202604209863241128", tp, "CCM", "CHRIS COONS FOR DELAWARE", "NEWARK", "DE", "19714", "", "",
    "03232026", amt, other, cand, "T1", "1", memo, "", "1"].join("|");
const ROWS = [
  line("C00761957", "24K", "5000", "C00475392"),
  line("C00761957", "24K", "5000", "C00475392"),
  line("C00761957", "24K", "5000", "C00475392"),
  line("C00761957", "24K", "-5000", "C00475392"),            // refund of an excessive contribution
  line("C00797670", "24K", "5000", "C00475392"),
  line("C00797670", "24K", "5000", "C00475392"),
  line("C00797670", "24K", "-6", "C00475392"),               // void reported by the giver
  line("C00369751", "24K", "1000", "C00475392", "S0DE00092", "X"), // memo row: counted
  line("C00369751", "24Z", "500", "C00475392"),              // in-kind: counted
  line("C00999999", "24E", "90000", "", "S0DE00092"),        // independent expenditure: not a contribution
  line("C00999998", "24A", "70000", "", "S0DE00092"),        // independent expenditure opposing
  line("C00999997", "24C", "20000", "C00475392"),            // party coordinated expenditure
  line("C00888888", "24K", "5000", "C00888000", "S0DE00092"), // to a committee that isn't Coons's
];
const CCL = [
  "S0DE00092|2026|2026|C00475392|S|P|1",
  "S0DE00092|2026|2026|C00888000|N|J|2",  // joint fundraising committee: not the candidate's own
  "H0XX00001|2026|2026|C00111111|H|P|3",
];
const NAMES = new Map([["C00761957", "IN OUR HANDS"], ["C00797670", "AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE POLITICAL ACTION COMMITTEE"], ["C00369751", "DELL TECHNOLOGIES, INC. POLITICAL ACTION COMMITTEE"]]);

test("parse a pas2 line by the FEC's column order", () => {
  const r = parsePas2(ROWS[0]);
  assert.equal(r.CMTE_ID, "C00761957");
  assert.equal(r.TRANSACTION_TP, "24K");
  assert.equal(r.OTHER_ID, "C00475392");
  assert.equal(r.TRANSACTION_AMT, "5000");
  assert.equal(parsePas2("too|short"), null);
});

test("authorized committees: principal and authorized only, for the candidates asked for", () => {
  const idx = authorizedIndex(CCL, new Set(["S0DE00092"]));
  assert.deepEqual([...idx.keys()], ["C00475392"]);
});

test("totals: direct and in-kind contributions to the candidate's committees, net of negative entries", () => {
  const idx = authorizedIndex(CCL, new Set(["S0DE00092"]));
  const totals = new Map();
  const counted = ROWS.filter((l) => addRow(totals, parsePas2(l), idx)).length;
  assert.equal(counted, 9);
  const coons = totals.get("S0DE00092");
  assert.deepEqual(coons.get("C00761957"), { cents: 1_000_000, contributions: 3 });
  assert.deepEqual(coons.get("C00797670"), { cents: 999_400, contributions: 2 });
  assert.deepEqual(coons.get("C00369751"), { cents: 150_000, contributions: 2 });
  assert.equal(coons.has("C00999999"), false);
  assert.equal(coons.has("C00999997"), false);
  assert.equal(coons.has("C00888888"), false);
});

test("ranking: largest first, ties by name, cut never inside a tie, refunded givers left out", () => {
  const g = (cents) => ({ cents, contributions: 1 });
  const by = new Map([["C1", g(500)], ["C2", g(1000)], ["C3", g(1000)], ["C4", g(1000)], ["C5", g(0)], ["C6", g(200)]]);
  const names = new Map([["C2", "Bravo"], ["C3", "Alpha"], ["C4", "Charlie"], ["C1", "Delta"], ["C6", "Echo"]]);
  assert.deepEqual(rankGivers(by, names).map((r) => r.id), ["C3", "C2", "C4", "C1", "C6"]);
  assert.deepEqual(rankGivers(by, names, { top: 2 }).map((r) => r.id), ["C3", "C2", "C4"]); // tie at 1000 kept whole
  assert.deepEqual(rankGivers(by, names, { top: 2, cap: 2 }).map((r) => r.id), ["C3", "C2"]);
  assert.equal(rankGivers(by, new Map()).find((r) => r.id === "C2").name, "C2"); // unknown name -> ID
  assert.deepEqual(rankGivers(undefined, names), []);
});
