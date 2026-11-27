// California's new legislative terms (Dec 7, 2026) against Open States rows as they are today:
// re-elected members keep one open-ended role, so the calendar decides when a seat's data is behind.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calendarChecks, calendarStale, calendarTermStart, firstMondayOfDecember, isCurrentStateRole, resolveLegislativeSeats } from "../lib/stateleg.js";

const fx = JSON.parse(readFileSync(new URL("./fixtures/transition-2027.json", import.meta.url)));
const roles = fx.state_roles_ca.map((r) => ({ ...r, id: r.person_id }));
// Open States was updated after the 2024 term began (roles starting 2024-12-02 exist in both
// chambers), which the lookup finds with a query; here it's given.
const R2024 = new Set(["lower|2024-12-02", "upper|2024-12-02"]);
const names = (list) => list.map((o) => (o.updating ? `updating ${o.type} ${o.district}` : o.name)).sort();

test("first Monday in December", () => {
  assert.equal(firstMondayOfDecember(2026), "2026-12-07");
  assert.equal(firstMondayOfDecember(2024), "2024-12-02");
  assert.equal(firstMondayOfDecember(2025), "2025-12-01"); // Dec 1 is itself a Monday
  assert.equal(firstMondayOfDecember(2030), "2030-12-02");
});

test("California calendar: every Assembly seat each even year; Senate even districts in 2026, odd in 2024", () => {
  assert.equal(calendarTermStart("CA", "lower", "72", "2026-12-06"), "2024-12-02");
  assert.equal(calendarTermStart("CA", "lower", "72", "2026-12-07"), "2026-12-07");
  assert.equal(calendarTermStart("CA", "upper", "38", "2026-12-07"), "2026-12-07");
  assert.equal(calendarTermStart("CA", "upper", "36", "2026-12-07"), "2026-12-07"); // even: on the 2026 ballot
  assert.equal(calendarTermStart("CA", "upper", "37", "2026-12-07"), "2024-12-02");
  assert.equal(calendarTermStart("CA", "upper", "038", "2027-01-04"), "2026-12-07");
  assert.equal(calendarTermStart("TX", "lower", "1", "2027-01-04"), null); // no calendar: end dates decide
});

test("before Dec 7, 2026 everyone listed shows as today", () => {
  assert.deepEqual(names(resolveLegislativeSeats({ state: "CA", today: "2026-12-06", roles, refreshed: R2024 })),
    ["Catherine Blakespear", "Diane Dixon", "Tony Strickland", "Tri Ta"]);
});

test("from Dec 7, 2026, seats with a new term show as updating until Open States is updated", () => {
  const out = resolveLegislativeSeats({ state: "CA", today: "2026-12-07", roles, refreshed: R2024 });
  assert.deepEqual(names(out), ["updating lower 70", "updating lower 72", "updating upper 36", "updating upper 38"]);
  const u = out.find((o) => o.updating && o.district === "72");
  assert.equal(u.term_began, "2026-12-07");
  assert.equal(u.roster, "https://www.assembly.ca.gov/assemblymembers");
  assert.equal(out.find((o) => o.updating && o.type === "upper").roster, "https://www.senate.ca.gov/senators");
  assert.ok(out.every((o) => !o.updating || (o.id === null && !o.name && !o.party)), "no name or party on an updating seat");
  // Same on Jan 4, 2027 if Open States still hasn't changed.
  assert.equal(resolveLegislativeSeats({ state: "CA", today: "2027-01-04", roles, refreshed: R2024 }).filter((o) => o.updating).length, 4);
  // An odd Senate district (not on the 2026 ballot) keeps its holder.
  const odd = { ...roles[2], id: "x", name: "Odd District Member", district: "37", district_key: "37", start_date: "2024-12-02" };
  assert.deepEqual(names(resolveLegislativeSeats({ state: "CA", today: "2026-12-07", roles: [odd], refreshed: R2024 })), ["Odd District Member"]);
});

test("once Open States adds the new term's members, the seats show them", () => {
  const newMember = { id: "ocd-person/new", person_id: "ocd-person/new", name: "New Member", party: "Democratic", active: true, type: "lower", district: "72", district_key: "72", start_date: "2026-12-07", end_date: null };
  const ended = roles.map((r) => (r.district === "72" && r.type === "lower" ? { ...r, end_date: "2026-12-07" } : r));
  // The chamber has been updated (someone's role starts on Dec 7): a member kept in their earlier
  // role (re-elected) shows again; the departing member's ended role doesn't.
  const refreshed = new Set([...R2024, "lower|2026-12-07"]);
  const out = resolveLegislativeSeats({ state: "CA", today: "2026-12-10", roles: [...ended, newMember], refreshed });
  assert.deepEqual(names(out), ["New Member", "Tri Ta", "updating upper 36", "updating upper 38"]);
  // A new role listed ahead of time doesn't show before its start.
  const early = resolveLegislativeSeats({ state: "CA", today: "2026-12-01", roles: [...roles, { ...newMember, start_date: "2026-12-07" }], refreshed: R2024 });
  assert.ok(early.some((o) => o.name === "Diane Dixon") && !early.some((o) => o.name === "New Member"));
});

test("states without a calendar: an ended role with no successor shows as updating, not the holder", () => {
  const az = [
    { id: "a", name: "Leaving Member", party: "Republican", active: true, type: "lower", district: "5", district_key: "5", start_date: "2023-01-09", end_date: "2027-01-11" },
    { id: "b", name: "Staying Member", party: "Democratic", active: true, type: "lower", district: "5", district_key: "5", start_date: "2023-01-09", end_date: null },
  ];
  assert.deepEqual(names(resolveLegislativeSeats({ state: "AZ", today: "2027-01-10", roles: az })), ["Leaving Member", "Staying Member"]);
  const after = resolveLegislativeSeats({ state: "AZ", today: "2027-01-11", roles: az });
  assert.deepEqual(names(after), ["Staying Member", "updating lower 5"]);
  assert.equal(after.find((o) => o.updating).term_ended, "2027-01-11");
  const replaced = [...az, { id: "c", name: "Successor", party: "Democratic", active: true, type: "lower", district: "5", district_key: "5", start_date: "2027-01-11", end_date: null }];
  assert.deepEqual(names(resolveLegislativeSeats({ state: "AZ", today: "2027-01-12", roles: replaced })), ["Staying Member", "Successor"]);
});

test("end dates are the first day not served", () => {
  assert.equal(isCurrentStateRole({ start_date: "2023-01-02", end_date: "2027-01-04" }, "2027-01-03"), true);
  assert.equal(isCurrentStateRole({ start_date: "2023-01-02", end_date: "2027-01-04" }, "2027-01-04"), false);
  assert.equal(isCurrentStateRole({ start_date: "2027-01-04", end_date: null }, "2027-01-03"), false);
});

test("state person page: a role is stale after a calendar term start until the chamber is updated", () => {
  const dixon = roles.find((r) => r.district === "72");
  assert.equal(calendarStale("CA", dixon, "2026-12-06", R2024), null);
  assert.equal(calendarStale("CA", dixon, "2026-12-07"), "2026-12-07");
  assert.equal(calendarStale("CA", dixon, "2026-12-07", new Set(["lower|2026-12-07"])), null);
  assert.equal(calendarStale("CA", roles.find((r) => r.district === "36"), "2026-12-06", R2024), null);
  assert.deepEqual(calendarChecks("CA", [...roles, { type: "upper", district: "37" }], "2026-12-07").map((c) => `${c.type}|${c.termStart}`).sort(),
    ["lower|2026-12-07", "upper|2024-12-02", "upper|2026-12-07"]);
});
