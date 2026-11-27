import { test } from "node:test";
import assert from "node:assert/strict";
import { officialRow, officialsToSync, billRow, billKey, billPath, cleanDistricts, districtsState, emailChoice,
  unsubscribeParams, exportFileName, looksLikeEmail, cleanCode } from "../src/lib/account.js";

const OCD = "ocd-person/00175071-948a-4814-b66e-b07b2ec7785d";

test("saved officials: member and state IDs only", () => {
  assert.deepEqual(officialRow("P000145"), { kind: "member", official_id: "P000145" });
  assert.deepEqual(officialRow(OCD), { kind: "state", official_id: OCD });
  assert.equal(officialRow("p000145"), null);
  assert.equal(officialRow("123 Main St"), null);
  assert.equal(officialRow(undefined), null);
});

test("sync offers only this device's officials not already saved, once each", () => {
  const saved = [{ kind: "member", official_id: "P000145" }];
  assert.deepEqual(officialsToSync(["P000145", "S001150", "S001150", "bad"], saved), [{ kind: "member", official_id: "S001150" }]);
  assert.deepEqual(officialsToSync([], saved), []);
  assert.deepEqual(officialsToSync(null, null), []);
});

test("bills: checked and keyed like the site's bill pages", () => {
  const r = billRow("119", "HR", "1");
  assert.deepEqual(r, { congress: 119, bill_type: "hr", number: 1 });
  assert.equal(billKey(r), "119-hr-1");
  assert.equal(billPath(r), "/bill/119/hr/1");
  assert.equal(billRow(119, "amendment", 1), null);
  assert.equal(billRow(119, "hr", 0), null);
  assert.equal(billRow("x", "s", 5), null);
});

test("saved districts keep district numbers and drop anything like an address", () => {
  const link = "st=CA&cg=119&cd=45&su=36&sl=70&bo=4&co=ca-orange&sd=1&pl=Los+Alamitos&pt=c&cc=1";
  assert.equal(cleanDistricts(link), link);
  assert.equal(cleanDistricts("st=CA&cd=45&address=123+Main+St&lat=33.8"), "st=CA&cd=45");
  assert.equal(cleanDistricts("pl=12345+Katella+Ave&st=CA"), "st=CA");
  assert.equal(cleanDistricts("cd=45"), null);
  assert.equal(cleanDistricts(null), null);
  assert.equal(cleanDistricts("st=CA&" + "x".repeat(400)), null);
  assert.equal(districtsState(link), "CA");
});

test("email choices: known kinds only", () => {
  assert.deepEqual(emailChoice("weekly_digest", 1), { weekly_digest: true });
  assert.deepEqual(emailChoice("bill_updates", false), { bill_updates: false });
  assert.throws(() => emailChoice("marketing", true));
});

test("unsubscribe links need a full token and a known kind", () => {
  const t = "7c96070b-f57f-4d09-8f9e-04ec9e6cffe0";
  assert.deepEqual(unsubscribeParams(`?t=${t}&k=bill_updates`), { token: t, kind: "bill_updates" });
  assert.deepEqual(unsubscribeParams(`?t=${t.toUpperCase()}`), { token: t, kind: "all" });
  assert.equal(unsubscribeParams(`?t=${t.slice(0, 20)}`), null);
  assert.equal(unsubscribeParams(`?t=${t}&k=everything`), null);
  assert.equal(unsubscribeParams(""), null);
});

test("small helpers", () => {
  assert.equal(exportFileName(new Date("2026-11-27T12:00:00Z")), "civic-atlas-account-2026-11-27.json");
  assert.ok(looksLikeEmail(" someone@example.org "));
  assert.ok(!looksLikeEmail("someone@"));
  assert.ok(!looksLikeEmail("two words@example.org"));
  assert.equal(cleanCode("12 34-56"), "123456");
  assert.equal(cleanCode("12345678901234"), "1234567890");
});
