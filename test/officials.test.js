import { test } from "node:test";
import assert from "node:assert/strict";
import { continuousStart } from "../lib/officials.js";

test("in this office since: back-to-back terms in the same office join up", () => {
  const roles = [
    { type: "governor", district_key: null, start_date: "2019-01-07", end_date: "2023-01-02" },
    { type: "governor", district_key: null, start_date: "2023-01-02", end_date: "2027-01-04" },
  ];
  assert.equal(continuousStart({ type: "governor", district: null, start_date: "2023-01-02" }, roles), "2019-01-07");
  // An appointee's partial term followed by an elected one.
  const ag = [{ type: "attorney general", district_key: null, start_date: "2021-04-23", end_date: "2023-01-02" }];
  assert.equal(continuousStart({ type: "attorney general", district: null, start_date: "2023-01-02" }, ag), "2021-04-23");
  // A gap (lost a race, came back) starts over; another district or office doesn't count.
  const gap = [
    { type: "lower", district_key: "66", start_date: "2012-12-03", end_date: "2014-11-30" },
    { type: "lower", district_key: "65", start_date: "2014-12-01", end_date: "2016-12-05" },
  ];
  assert.equal(continuousStart({ type: "lower", district: "66", start_date: "2016-12-05" }, gap), "2016-12-05");
});
