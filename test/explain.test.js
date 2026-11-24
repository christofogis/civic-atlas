import { test } from "node:test";
import assert from "node:assert/strict";
import { findMembers, findBills, htmlToText } from "../lib/explain.js";

const members = [
  { bioguide_id: "P000145", name: "Alex Padilla", first_name: "Alex", last_name: "Padilla", chamber: "senate" },
  { bioguide_id: "S001150", name: "Adam B. Schiff", first_name: "Adam", last_name: "Schiff", chamber: "senate" },
  { bioguide_id: "O000172", name: "Alexandria Ocasio-Cortez", first_name: "Alexandria", last_name: "Ocasio-Cortez", chamber: "house" },
  { bioguide_id: "J000001", name: "Mike Johnson", first_name: "Mike", last_name: "Johnson", chamber: "house" },
  { bioguide_id: "J000002", name: "Hank Johnson", first_name: "Hank", last_name: "Johnson", chamber: "house" },
  { bioguide_id: "S000000", name: "Rick Scott", first_name: "Rick", last_name: "Scott", chamber: "senate" },
  { bioguide_id: "S000001", name: "Tim Scott", first_name: "Tim", last_name: "Scott", chamber: "senate" },
];
const ids = (t) => findMembers(t, members).map((m) => m.bioguide_id).sort();

test("full names and unique titled last names", () => {
  assert.deepEqual(ids("Sen. Padilla and Adam Schiff spoke with Rep. Ocasio-Cortez."), ["O000172", "P000145", "S001150"]);
});

test("ambiguous last names need a full name", () => {
  assert.deepEqual(ids("Rep. Johnson said; Sen. Scott agreed."), []);
  assert.deepEqual(ids("Speaker Mike Johnson and Sen. Tim Scott"), ["J000001", "S000001"]);
});

test("no match on ordinary words", () => {
  assert.deepEqual(ids("Padilla Street was closed for a scott-free parade."), []);
});

test("bills and html", () => {
  assert.deepEqual(findBills(htmlToText("<p>The House passed <b>H.R. 4791</b> and S.&nbsp;1462.</p><script>var x='H.R. 9'</script>")).map((r) => r.bill_type + r.number).sort(), ["hr4791", "s1462"]);
});
