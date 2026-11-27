import test from "node:test";
import assert from "node:assert/strict";
import { splitBillRefs } from "../lib/billrefs.js";

test("splitBillRefs keeps the text and marks bill numbers", () => {
  const parts = splitBillRefs("Received in the Senate. See also H.R. 1234 and S. 5; U.S. 1 is not a bill.");
  assert.equal(parts.map((p) => p.text).join(""), "Received in the Senate. See also H.R. 1234 and S. 5; U.S. 1 is not a bill.");
  assert.deepEqual(parts.filter((p) => p.bill_type).map((p) => `${p.bill_type}${p.number}`), ["hr1234", "s5"]);
  assert.deepEqual(splitBillRefs(""), []);
});
