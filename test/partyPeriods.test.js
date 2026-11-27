import { test } from "node:test";
import assert from "node:assert/strict";
import { mapLegislators, mapPartyPeriods, periodKey } from "../scripts/ingest/members.mjs";
import { termPartyPeriods, termPartyOn } from "../lib/partyPeriods.js";

// As listed in unitedstates/congress-legislators (checked Nov 27, 2026).
const manchinTerm = {
  type: "sen", start: "2019-01-03", end: "2025-01-03", state: "WV", class: 1, party: "Independent", caucus: "Democrat",
  party_affiliations: [
    { start: "2019-01-03", end: "2024-05-31", party: "Democrat" },
    { start: "2024-05-31", end: "2025-01-03", party: "Independent", caucus: "Democrat" },
  ],
};
const kileyTerm = {
  type: "rep", start: "2025-01-03", end: "2027-01-03", state: "CA", district: 3, party: "Independent", caucus: "Republican",
  party_affiliations: [
    { start: "2025-01-03", end: "2026-03-08", party: "Republican" },
    { start: "2026-03-09", end: "2027-01-03", party: "Independent", caucus: "Republican" },
  ],
};
const person = (bioguide, last, terms) => ({ id: { bioguide }, name: { first: "X", last }, terms });

test("party_affiliations become one row per stretch, keyed to their term", () => {
  const { terms, periods } = mapLegislators([
    person("M001183", "Manchin", [{ type: "sen", start: "2013-01-03", end: "2019-01-03", state: "WV", class: 1, party: "Democrat" }, manchinTerm]),
    person("K000401", "Kiley", [kileyTerm]),
  ]);
  assert.equal(terms.length, 3);
  assert.equal(terms[1].party, "Independent"); // the term keeps the source's party (the latest)
  assert.deepEqual(periods, [
    { bioguide_id: "M001183", chamber: "senate", term_start_date: "2019-01-03", start_date: "2019-01-03", end_date: "2024-05-31", party: "Democrat", caucus: null },
    { bioguide_id: "M001183", chamber: "senate", term_start_date: "2019-01-03", start_date: "2024-05-31", end_date: "2025-01-03", party: "Independent", caucus: "Democrat" },
    { bioguide_id: "K000401", chamber: "house", term_start_date: "2025-01-03", start_date: "2025-01-03", end_date: "2026-03-08", party: "Republican", caucus: null },
    { bioguide_id: "K000401", chamber: "house", term_start_date: "2025-01-03", start_date: "2026-03-09", end_date: "2027-01-03", party: "Independent", caucus: "Republican" },
  ]);
  assert.equal(new Set(periods.map(periodKey)).size, 4);
  assert.deepEqual(mapPartyPeriods("A000001", "house", { start: "2025-01-03", party: "Democrat" }), []); // no change, no rows
});

// The member page's term as the database returns it.
const asPageTerm = (bioguide, chamber, t) => ({
  chamber, state: t.state, party: t.party, start_date: t.start, end_date: t.end,
  party_periods: mapPartyPeriods(bioguide, chamber, t).map(({ party, caucus, start_date, end_date }) => ({ party, caucus, start_date, end_date })),
});

test("party on a date follows the stretch covering it", () => {
  const manchin = asPageTerm("M001183", "senate", manchinTerm);
  const kiley = asPageTerm("K000401", "house", kileyTerm);
  assert.equal(termPartyOn(manchin, "2023-02-01"), "Democrat");
  assert.equal(termPartyOn(manchin, "2024-05-31"), "Independent"); // the day both stretches list: the later one
  assert.equal(termPartyOn(manchin, "2024-09-01"), "Independent");
  assert.equal(termPartyOn(kiley, "2026-03-08"), "Republican");
  assert.equal(termPartyOn(kiley, "2026-03-09"), "Independent");
  assert.deepEqual(termPartyPeriods(kiley).map((p) => p.party), ["Republican", "Independent"]);
});

test("a term without a change is one stretch of its listed party", () => {
  const t = { party: "Republican", start_date: "2023-01-03", end_date: "2025-01-03", party_periods: [] };
  assert.deepEqual(termPartyPeriods(t), [{ party: "Republican", caucus: null, start_date: "2023-01-03", end_date: "2025-01-03" }]);
  assert.equal(termPartyOn({ ...t, party_periods: undefined }, "2024-01-01"), "Republican"); // before the migration
  assert.equal(termPartyOn(t, "2025-02-01"), null);
});
