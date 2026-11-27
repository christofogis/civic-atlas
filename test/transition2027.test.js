// Dry run of the 120th Congress transition (Jan 3, 2027) and the California Legislature's new terms
// (Dec 7, 2026): the site's date-dependent logic with a fake "today", against rows copied from the
// live database (test/fixtures/transition-2027.json). The same moment is rendered against the live
// database by scripts/probe/transition_2027.py (the probe workflow).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { congressOn, nextElectionYear, seatNextUp, servedInCongress } from "../lib/congress.js";
import { currentRoles, leadershipPending } from "../lib/leadership.js";
import { ballotOutcome, outcomeKnownFor, nextElectionYear as ballotYear } from "../lib/upForElection.js";
import { billTrack } from "../lib/billTrack.js";
import { votesPlan } from "../scripts/ingest/votes.mjs";
import { childSitemaps } from "../lib/sitemap.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/transition-2027.json", import.meta.url)));
const JAN4 = "2027-01-04";

test("which Congress: the 120th from Jan 3, 2027 (Eastern time)", () => {
  assert.equal(congressOn("2027-01-02"), 119);
  assert.equal(congressOn("2027-01-03"), 120);
  assert.equal(congressOn(JAN4), 120);
  assert.equal(congressOn(new Date("2027-01-03T04:59:00Z")), 119); // 11:59 p.m. Jan 2 in Washington
  assert.equal(congressOn(new Date("2027-01-03T05:00:00Z")), 120);
});

test("elections: the next one is 2028; seats next up", () => {
  assert.equal(nextElectionYear(new Date(`${JAN4}T12:00:00Z`)), 2028);
  assert.equal(ballotYear(JAN4), 2028);
  assert.equal(seatNextUp("house", null, new Date(`${JAN4}T12:00:00Z`)), 2028);
  assert.equal(seatNextUp("senate", 3, new Date(`${JAN4}T12:00:00Z`)), 2028);
  assert.equal(seatNextUp("senate", 2, new Date(`${JAN4}T12:00:00Z`)), 2032);
});

test("per-Congress figures: a member whose last term ended Jan 3, 2027 didn't serve in the 120th", () => {
  const ca47 = fx.terms.filter((t) => t.bioguide_id === "M001241");
  assert.equal(servedInCongress(ca47, "house", 119), true);
  assert.equal(servedInCongress(ca47, "house", 120), false);
  const padilla = fx.terms.filter((t) => t.bioguide_id === "P000145");
  assert.equal(servedInCongress(padilla, "senate", 120), true);
});

test("leadership: no 119th post is shown as current on Jan 4; the page says the 120th's aren't in yet", () => {
  assert.equal(currentRoles(fx.leadership_roles, "2027-01-02").length, 6);
  assert.deepEqual(currentRoles(fx.leadership_roles, JAN4), []);
  assert.equal(leadershipPending(fx.leadership_roles, "house", JAN4), true);
  assert.equal(leadershipPending(fx.leadership_roles, "house", "2026-11-27"), false);
  // Once the source records the new Congress (e.g. a new Speaker and the new minority leader), those show.
  const updated = [...fx.leadership_roles,
    { bioguide_id: "X000001", chamber: "house", title: "Speaker of the House", start_date: "2027-01-03", end_date: null },
    { bioguide_id: "X000002", chamber: "house", title: "House Minority Leader", start_date: "2027-01-03", end_date: null }];
  assert.deepEqual(currentRoles(updated, JAN4).map((r) => r.bioguide_id), ["X000001", "X000002"]);
  assert.equal(leadershipPending(updated, "house", JAN4), false);
  assert.equal(leadershipPending(updated, "senate", JAN4), true);
});

test("on the ballot (2026): outcomes wait for each chamber's new terms", () => {
  const seats = fx.terms;
  const durbin = seats.find((t) => t.bioguide_id === "D000563");
  const house = seats.find((t) => t.bioguide_id === "M001241");
  assert.equal(ballotOutcome(seats, durbin, 2026, JAN4), null); // nothing new in the data yet
  // Senators added first: Senate outcomes show; House ones still wait instead of reading "did not return".
  const withSenate = [...seats, { bioguide_id: "N000001", chamber: "senate", state: "IL", senate_class: 2, start_date: "2027-01-03", end_date: "2033-01-03" }];
  assert.deepEqual(ballotOutcome(withSenate, durbin, 2026, JAN4), { returned: false, next: withSenate.at(-1) });
  assert.equal(outcomeKnownFor(withSenate, "house", 2026, JAN4), false);
  assert.equal(ballotOutcome(withSenate, house, 2026, JAN4), null);
  // Ohio's special election: Husted's appointment ended Dec 15, 2026; the winner's term starts then.
  const husted = seats.find((t) => t.bioguide_id === "H001104");
  const brown = { bioguide_id: "B000944", chamber: "senate", state: "OH", senate_class: 3, start_date: "2026-12-15", end_date: "2029-01-03", how: "special-election" };
  assert.deepEqual(ballotOutcome([...withSenate, brown], husted, 2026, JAN4), { returned: false, next: brown });
});

test("bills: a 119th Congress bill still pending reads as ended once the 120th begins", () => {
  const b = { congress: 119, bill_type: "hr", number: 5, introduced_date: "2025-02-01", passed_house_date: "2025-04-01" };
  assert.equal(billTrack(b, { today: new Date("2026-12-31T12:00:00Z") }).status, "pending");
  assert.equal(billTrack(b, { today: new Date(`${JAN4}T12:00:00Z`) }).status, "ended");
});

test("votes ingest: the week of Jan 3 reads both Congresses; the 120th from roll call 1 for three weeks", () => {
  const rows = [118, 119, 120].map((n) => ({ number: n, start_date: `${1787 + 2 * n}-01-03`, end_date: `${1789 + 2 * n}-01-03` }));
  assert.deepEqual(votesPlan("2026-12-31", rows), [{ congress: 119, fromStart: false }]);
  assert.deepEqual(votesPlan("2027-01-03", rows), [{ congress: 119, fromStart: false }, { congress: 120, fromStart: true }]);
  assert.deepEqual(votesPlan("2027-01-12", rows), [{ congress: 120, fromStart: true }]);
  assert.deepEqual(votesPlan("2027-01-24", rows), [{ congress: 120, fromStart: false }]);
  assert.deepEqual(votesPlan("2029-01-04", rows), []); // the 121st isn't in the congresses table: the job fails loudly
});

test("sitemap: a Congress with no bills yet adds no empty child sitemap", () => {
  assert.deepEqual(childSitemaps({ bills: { 118: 1500, 119: 900, 120: 0 }, statePeople: 0 }),
    ["/sitemap/main.xml", "/sitemap/bills-118-1.xml", "/sitemap/bills-118-2.xml", "/sitemap/bills-119-1.xml"]);
});

test("saved links and remembered representatives from the 119th are set aside on Jan 4", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date(`${JAN4}T17:00:00Z`) });
  try {
    const { savedDistrictsFrom } = await import("../lib/savedLink.js");
    const old = savedDistrictsFrom(new URLSearchParams("st=CA&cg=119&cd=47&sl=72&su=36"));
    assert.equal(old.stale, true);
    assert.deepEqual(old.districts, []); // House district dropped: lines changed in California
    assert.equal(old.congress, 120);
    assert.deepEqual(old.stateDistricts.lower, ["72"]);
    const fresh = savedDistrictsFrom(new URLSearchParams("st=CA&cg=120&cd=42"));
    assert.equal(fresh.stale, false);
    const store = new Map();
    globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
    globalThis.sessionStorage = { getItem: () => null, removeItem: () => {} };
    store.set("civic-atlas:my-reps", JSON.stringify({ c: 119, ids: ["M001241"] }));
    const { myRepresentatives, representativesOutdated } = await import("../src/lib/myReps.js");
    assert.equal(myRepresentatives().size, 0);
    assert.equal(representativesOutdated(), true);
  } finally {
    mock.timers.reset();
    delete globalThis.localStorage; delete globalThis.sessionStorage;
  }
});

// The lookup (lib/officials.js) with the database faked from the fixture rows: what /api/lookup
// would return for a Los Alamitos address (CA-47 under the 119th lines; AD 72, SD 36) on a date.
function fakeDatabase(today) {
  const people = new Map(fx.state_roles_ca.map((r) => [r.person_id, r]));
  const roles = [...fx.state_roles_ca,
    { person_id: "ocd-person/newsom", name: "Gavin Newsom", party: "Democratic", active: true, type: "governor", district: null, district_key: null, start_date: "2023-01-02", end_date: "2027-01-04" }];
  people.set("ocd-person/newsom", roles.at(-1));
  // Elsewhere in the state: members whose roles began with the 2024 term (in the live data, 23 in
  // the Assembly and 14 in the Senate), which tells the lookup Open States was updated for it.
  roles.push({ person_id: "ocd-person/a1", type: "lower", district: "1", district_key: "1", start_date: "2024-12-02", end_date: null },
    { person_id: "ocd-person/s1", type: "upper", district: "1", district_key: "1", start_date: "2024-12-02", end_date: null });
  const inAddress = (r) => r.type === "governor" || (r.type === "lower" && r.district_key === "72") || (r.type === "upper" && r.district_key === "36");
  const seatHolders = (asOf) => {
    // Same rules as the seat_holders view: latest started term per seat, ended within 30 days.
    const since = new Date(Date.parse(asOf) - 30 * 864e5).toISOString().slice(0, 10);
    const best = new Map();
    for (const t of fx.terms.filter((x) => x.state === "CA" && x.start_date <= asOf && x.end_date > since)) {
      const k = `${t.chamber}|${t.chamber === "house" ? t.district : t.senate_class}`;
      if (!best.has(k) || best.get(k).start_date < t.start_date) best.set(k, t);
    }
    return [...best.values()].map((t) => ({ ...t, seat_status: asOf < t.end_date ? "serving" : "pending_update" }));
  };
  return async (url) => {
    const u = new URL(url);
    const path = u.pathname.replace("/rest/v1/", "");
    const q = u.searchParams;
    const ok = (body) => ({ ok: true, json: async () => body });
    if (path === "rpc/seat_holders_on") return ok(seatHolders(q.get("as_of")));
    if (path === "members" || path === "terms") return ok([]);
    if (path === "state_people") return ok([...people.values()].map((p) => ({ id: p.person_id, name: p.name, party: p.party, active: p.active, offices: [], image_url: null })));
    if (path === "state_roles" && q.get("start_date")) {
      // The "has Open States been updated for this term" probe.
      const [gte, lte] = q.getAll("start_date").map((v) => v.split(".")[1]);
      return ok(roles.filter((r) => r.type === q.get("type").slice(3) && r.start_date >= gte && r.start_date <= lte).slice(0, 1));
    }
    if (path === "state_roles") return ok(roles.filter(inAddress));
    throw new Error(`unexpected ${path}`);
  };
}

for (const [day, expectState, expectFed] of [
  ["2026-12-06", ["Tony Strickland", "Diane Dixon", "Gavin Newsom"], ["serving", "serving", "serving"]],
  ["2026-12-07", ["updating upper 36", "updating lower 72", "Gavin Newsom"], ["serving", "serving", "serving"]],
  [JAN4, ["updating upper 36", "updating lower 72", "updating governor null"], ["serving", "serving", "pending_update"]],
]) {
  test(`lookup on ${day}: nobody shown as serving whose term has ended`, async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = fakeDatabase(day);
    try {
      const { officialsFor } = await import("../lib/officials.js");
      const r = await officialsFor({ state: "CA", districts: [47], congress: congressOn(day), approximate: false, asOf: day,
        stateDistricts: { upper: ["36"], lower: ["72"], boe: [] }, local: { covered: false } });
      assert.deepEqual(r.state_officials.map((o) => (o.updating ? `updating ${o.type} ${o.district}` : o.name)), expectState);
      assert.deepEqual(r.officials.map((o) => o.seat_status), expectFed);
      for (const o of r.officials.filter((x) => x.seat_status === "serving")) assert.ok(o.end_date > day, `${o.bioguide_id} serving past ${o.end_date}`);
      for (const o of r.state_officials.filter((x) => x.updating)) assert.equal(o.name, "");
    } finally { globalThis.fetch = realFetch; }
  });
}
