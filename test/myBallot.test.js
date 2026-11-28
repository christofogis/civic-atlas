import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assembleBallot, electionsFor, houseCongressFor } from "../lib/myBallot.js";

const json = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const measures = json("../public/data/measures/ca-2028.json");
const local = json("../public/data/local/ca-orange.json");
const presidents = json("../public/data/us-control.json").presidents;
const caOc = json("./fixtures/my-ballot/officials-ca-oc.json");
const changed120 = json("../public/maps/meta.json").changed120;
const base = { measures, local, presidents, changed120 };
const offices = (e) => e.contests.map((c) => c.office);

// A lookup in Los Alamitos (Orange County), made under the 120th Congress's lines, in 2027.
const LOS_ALAMITOS = "st=CA&cg=120&cd=45&su=35&sl=72&bo=4&co=ca-orange&sd=1&pl=Los%20Alamitos&pt=c&cc=2";

test("2028 House races are on the 120th Congress's lines", () => {
  assert.equal(houseCongressFor(2028), 120);
});

test("California has the March 7 primary and the November 7 general; elsewhere only the federal general", () => {
  assert.deepEqual(electionsFor("CA", 2028, measures).map((e) => [e.date, e.kind]), [["2028-03-07", "primary"], ["2028-11-07", "general"]]);
  assert.deepEqual(electionsFor("TX", 2028, measures).map((e) => [e.date, e.kind]), [["2028-11-07", "general"]]);
});

test("Orange County (Los Alamitos): every level, in ballot order", () => {
  const b = assembleBallot({ ...base, params: LOS_ALAMITOS, result: caOc, today: "2027-06-01" });
  const [march, nov] = b.elections;
  assert.deepEqual(offices(march), ["president", "us-senate", "us-house", "state-senate", "assembly", "supervisor"]);
  assert.deepEqual(offices(nov), ["president", "us-senate", "us-house", "state-senate", "assembly", "supervisor", "council"]);
  // Padilla's class 3 seat is up; Schiff's (ends 2031) is not.
  const senate = march.contests.filter((c) => c.office === "us-senate");
  assert.deepEqual(senate.map((c) => c.holders[0].id), ["P000145"]);
  assert.equal(march.contests.find((c) => c.office === "us-house").holders[0].name, "Test House Member");
  // Odd-numbered state Senate district 35 is up in 2028; the Assembly always is.
  assert.equal(march.contests.find((c) => c.office === "state-senate").holders[0].href, "/state/person/aaaa");
  assert.equal(march.contests.find((c) => c.office === "assembly").status, "held");
  // Supervisor District 1 (term ends Jan 2029): majority wins in March, November only if no one did.
  assert.equal(march.contests.find((c) => c.office === "supervisor").primary, "majority");
  assert.equal(nov.contests.find((c) => c.office === "supervisor").general, "if-no-majority");
  assert.equal(nov.contests.find((c) => c.office === "supervisor").holders[0].photo, null);
  // Los Alamitos District 2's term ends November 2028; councils are on the November ballot only.
  const council = nov.contests.find((c) => c.office === "council");
  assert.equal(council.district, 2);
  assert.deepEqual(council.holders.map((h) => h.name), ["Gary Loe"]);
  // Measures by election, linked by id.
  assert.deepEqual(march.measures.map((m) => m.id), ["sb-895"]);
  assert.deepEqual(nov.measures.map((m) => m.id), ["aca-7", "1995"]);
  assert.ok(b.notes.some((n) => n.key === "county-officers-unknown"));
  // Party is only ever on partisan offices; local offices carry none.
  for (const c of nov.contests.filter((x) => x.nonpartisan)) for (const h of c.holders) assert.equal(h.party, null);
});

test("before new terms begin, seats whose holder for 2028 isn't seated yet say so", () => {
  // Today (Nov 2026): a 119th-lines lookup in California, which redrew for the 120th.
  const b = assembleBallot({ ...base, params: "st=CA&cg=119&cd=42&su=35&sl=72&co=ca-orange&sd=1&pl=Los%20Alamitos&pt=c&cc=2", result: caOc, today: "2026-11-28" });
  const march = b.elections[0];
  const house = march.contests.find((c) => c.office === "us-house");
  assert.equal(house.status, "district-unknown");
  assert.equal(house.reason, "new-lines");
  const asm = march.contests.find((c) => c.office === "assembly");
  assert.equal(asm.status, "not-seated");
  assert.equal(asm.takesOffice, "2026-12-07");
  assert.equal(march.contests.find((c) => c.office === "state-senate").status, "held");
});

test("a state that didn't redraw keeps its district number; the holder is shown once seated", () => {
  const result = { state: "WA", officials: [
    { bioguide_id: "W1", chamber: "senate", party: "Democrat", end_date: "2029-01-03", seat_status: "current", name: "Senator Up" },
    { bioguide_id: "W2", chamber: "senate", party: "Democrat", end_date: "2031-01-03", seat_status: "current", name: "Senator Not Up" },
    { bioguide_id: "W3", chamber: "house", district: 7, party: "Democrat", end_date: "2027-01-03", seat_status: "current", name: "Rep 119" },
  ] };
  const b = assembleBallot({ ...base, params: "st=WA&cg=119&cd=7&su=43&sl=43", result, today: "2026-11-28" });
  assert.equal(b.elections.length, 1);
  const g = b.elections[0];
  assert.equal(g.date, "2028-11-07");
  assert.deepEqual(offices(g), ["president", "us-senate", "us-house"]);
  const house = g.contests.find((c) => c.office === "us-house");
  assert.equal(house.district, 7);
  assert.equal(house.status, "not-seated");
  assert.equal(house.takesOffice, "2027-01-03");
  assert.deepEqual(g.measures, []);
  assert.deepEqual(b.notes, [{ key: "state-not-covered", state: "WA" }]);
  // No top-two or other primary labels outside California.
  assert.ok(g.contests.every((c) => c.primary === null));
});

test("California outside Orange County: state contests, local not covered", () => {
  const result = { ...caOc, local: { covered: false, county: "Los Angeles County" } };
  const b = assembleBallot({ ...base, params: "st=CA&cg=120&cd=45&su=24&sl=66", result: { ...result, state_officials: [] }, today: "2027-06-01" });
  const [march, nov] = b.elections;
  // Even-numbered state Senate district 24 isn't up until 2030; the Assembly seat is, still updating.
  assert.deepEqual(offices(march), ["president", "us-senate", "us-house", "assembly"]);
  assert.equal(march.contests.find((c) => c.office === "assembly").status, "updating");
  assert.ok(b.notes.some((n) => n.key === "state-senate-not-up" && n.district === "24" && n.next === 2030));
  assert.ok(b.notes.some((n) => n.key === "local-not-covered"));
  assert.ok(!offices(nov).includes("council"));
  assert.deepEqual(nov.measures.map((m) => m.id), ["aca-7", "1995"]);
});

test("Orange County city not loaded yet, and a district not up in 2028", () => {
  const b = assembleBallot({ ...base, params: "st=CA&cg=120&cd=46&su=34&sl=68&co=ca-orange&sd=2&pl=Santa%20Ana&pt=c&cc=3", result: { ...caOc, state_officials: [] }, today: "2027-06-01" });
  assert.ok(!b.elections.some((e) => offices(e).includes("supervisor")));
  assert.ok(b.notes.some((n) => n.key === "supervisor-not-up" && n.district === 2));
  const city = b.notes.find((n) => n.key === "city-not-loaded");
  assert.equal(city.city, "Santa Ana");
  assert.match(city.url, /^https:\/\//);
  const la = assembleBallot({ ...base, params: "st=CA&cg=120&cd=45&co=ca-orange&sd=1&pl=Los%20Alamitos&pt=c&cc=4", result: caOc, today: "2027-06-01" });
  assert.ok(la.notes.some((n) => n.key === "council-not-up" && n.district === 4));
});

test("a stale link after the new Congress asks for a new lookup instead of guessing a district", () => {
  const b = assembleBallot({ ...base, params: "st=TX&cg=119&cd=7", result: { state: "TX", officials: [], stale_districts: 119 }, today: "2027-02-01" });
  const house = b.elections[0].contests.find((c) => c.office === "us-house");
  assert.equal(house.status, "district-unknown");
});
