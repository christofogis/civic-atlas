import { test } from "node:test";
import assert from "node:assert/strict";
import { billProgress } from "../lib/billprogress.js";

const a = (actionDate, actionCode, text, code = "9") => ({ actionDate, actionCode, text, sourceSystem: { code } });

test("H.R. 1 (119th) milestones", () => {
  const p = billProgress([
    a("2025-05-20", "1010", "reported an original measure"),
    a("2025-05-22", "8000", "Passed/agreed to in House"),
    a("2025-05-22", "H37100", "On passage Passed", "2"),
    a("2025-07-01", "17000", "Passed/agreed to in Senate"),
    a("2025-07-03", "28000", "Presented to President."),
    a("2025-07-04", "36000", "Signed by President."),
    a("2025-07-04", "36000", "Became Public Law No: 119-21."),
  ], { item: undefined, type: "Public Law", number: "119-21" });
  assert.equal(p.passed_house_date, "2025-05-22");
  assert.equal(p.passed_senate_date, "2025-07-01");
  assert.equal(p.presented_date, "2025-07-03");
  assert.equal(p.became_law_date, "2025-07-04");
  assert.equal(p.law_number, "Public Law 119-21");
  assert.equal(p.reported_date, null);
});

test("signed is not enactment; earliest date wins", () => {
  const p = billProgress([a("2025-07-04", "36000", "Signed by President."), a("2024-03-01", "5000", "Reported"), a("2024-02-01", "5000", "Reported")]);
  assert.equal(p.became_law_date, null);
  assert.equal(p.reported_date, "2024-02-01");
});
