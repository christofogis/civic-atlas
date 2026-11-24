import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "../src/lib/csv.js";

test("quotes, BOM and formula guard", () => {
  const out = toCsv([{ a: 'Say "hi", ok', b: "=HYPERLINK(1)", c: null }], [["A", (r) => r.a], ["B", (r) => r.b], ["C", (r) => r.c]]);
  assert.ok(out.startsWith("﻿A,B,C\r\n"));
  assert.ok(out.includes('"Say ""hi"", ok"'));
  assert.ok(out.includes("'=HYPERLINK(1)"));
  assert.ok(out.endsWith(",\r\n"));
});
