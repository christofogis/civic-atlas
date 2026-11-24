import { test } from "node:test";
import assert from "node:assert/strict";
import { extractBillRefs, congressForYear } from "../lib/billrefs.js";

const keys = (t) => extractBillRefs(t).map((r) => `${r.bill_type}${r.number}`).sort();

test("formats seen on LD-2 reports", () => {
  assert.deepEqual(keys("S.94 - Miracle on Ice Congressional Gold Medal Act H.R.452 - Miracle"), ["hr452", "s94"]);
  assert.deepEqual(keys("H.R. 4791/S. 1462, the Fix Our Forests Act; H.R. 1, One Big"), ["hr1", "hr4791", "s1462"]);
  assert.deepEqual(keys("HR973/S389 Setting Consumer Standards"), ["hr973", "s389"]);
  assert.deepEqual(keys("This includes HR 2011/S 944 the Sarah Debbink Act, S 811 the RTP"), ["hr2011", "s811", "s944"]);
  assert.deepEqual(keys("S.483 (HR 1117) - Responsibility"), ["hr1117", "s483"]);
  assert.deepEqual(keys("H. R. 22 and H.Res. 5; H.J.Res. 7, S.J.Res 3, S. Con. Res. 2, H.Con.Res.14, S.Res.9"),
    ["hconres14", "hjres7", "hr22", "hres5", "sconres2", "sjres3", "sres9"]);
  assert.deepEqual(keys("H.R. 8,070 the NDAA"), ["hr8070"]);
});

test("does not match look-alikes", () => {
  assert.deepEqual(keys("U.S. 1 highway; FY2026; Sec. 5; Title 5 U.S.C. 552; 10 U.S.C. 2304"), []);
  assert.deepEqual(keys("Section 811 and paragraphs 3 and s 5"), []);
  assert.deepEqual(keys("S. 1462a; H.R. 2.5 percent; HR3000000"), []);
  assert.deepEqual(keys("PUBLIC LAW 119-21; COVID-19; Form LD-2"), []);
});

test("deduplicates", () => {
  assert.deepEqual(keys("H.R. 1; HR1; H.R.1"), ["hr1"]);
});

test("congress for a filing year", () => {
  assert.equal(congressForYear(2023), 118);
  assert.equal(congressForYear(2024), 118);
  assert.equal(congressForYear(2025), 119);
  assert.equal(congressForYear(2027), 120);
});
