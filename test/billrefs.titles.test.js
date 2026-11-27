import { test } from "node:test";
import assert from "node:assert/strict";
import { billRefTitles, titleMatches } from "../lib/billrefs.js";

const titles = (s) => Object.fromEntries(billRefTitles(s));

test("a name written before numbers in parentheses covers each of them", () => {
  // Amazon, Q4 2023 LD-2: the numbers are from the 117th Congress's Equality Act.
  assert.deepEqual(titles("Equality Act (H.R. 5 / S. 393)"), { hr5: "Equality Act", s393: "Equality Act" });
  assert.deepEqual(titles("Issues related to the Lower Costs Act (H.R. 5378)"), { hr5378: "Lower Costs Act" });
  assert.deepEqual(titles("HR 2 (Secure the Border Act of 2023)"), { hr2: "Secure the Border Act of 2023" });
});

test("a name written after a number", () => {
  // Real Estate Roundtable, Q1 2026 LD-2: S. 2224 was this bill's number in the 118th Congress.
  assert.deepEqual(titles("S. 2224, Stop Predatory Investing Act"), { s2224: "Stop Predatory Investing Act" });
  assert.deepEqual(titles("H.R. 4791/S. 1462, the Fix Our Forests Act"), { hr4791: "Fix Our Forests Act", s1462: "Fix Our Forests Act" });
  assert.deepEqual(titles("S. 100, Foo Act, S. 200, Bar Act"), { s100: "Foo Act", s200: "Bar Act" });
  assert.deepEqual(titles("Foo Act (S. 100), Bar Act (S. 200)"), { s100: "Foo Act", s200: "Bar Act" });
});

test("in a comma list, a following name belongs to the last number only", () => {
  assert.deepEqual(titles("H.R. 2, H.R. 3, the Foo Act"), { hr2: null, hr3: "Foo Act" });
});

test("no name next to the number, or a description rather than a name", () => {
  assert.deepEqual(titles("H.R. 1234; H.R. 5678"), { hr1234: null, hr5678: null });
  assert.deepEqual(titles("S. 3, a bill to amend the Public Health Service Act"), { s3: null });
  assert.deepEqual(titles("Monitor H.R. 1234 and related legislation"), { hr1234: null });
  assert.deepEqual(titles("Affordable Care Act implementation (H.R. 5)"), { hr5: null });
});

test("names are compared with a bill's titles, leniently", () => {
  // The two audit examples, against the bills those numbers belong to in the report's Congress.
  assert.equal(titleMatches("Equality Act", ["Parents Bill of Rights Act"]), false);          // H.R. 5, 118th
  assert.equal(titleMatches("Equality Act", ["Social Security Expansion Act"]), false);      // S. 393, 118th
  assert.equal(titleMatches("Stop Predatory Investing Act", ["Taiwan International Solidarity Act"]), false); // S. 2224, 119th
  assert.equal(titleMatches("Stop Predatory Investing Act", [null, "Stop Predatory Investing Act"]), true);
  assert.equal(titleMatches("the Fix Our Forests Act", ["Fix our Forests Act of 2025"]), true);
  assert.equal(titleMatches("FY2026 National Defense Authorization Act", ["National Defense Authorization Act for Fiscal Year 2026"]), true);
  assert.equal(titleMatches("Lobbying on the Equality Act", ["Equality Act"]), true);
  assert.equal(titleMatches("SAFE Banking Act", ["SAFER Banking Act"]), false);
});
