import { test } from "node:test";
import assert from "node:assert/strict";
import { unevenChambers } from "../lib/photoBalance.js";

const mk = (n, party, withPhoto, type = "lower", state = "CT") =>
  Array.from({ length: n }, (_, i) => ({ id: `${state}${type}${party}${i}`, party, image_url: i < withPhoto ? "https://x.gov/a.jpg" : null, type, state }));

test("hides a chamber whose party photo shares differ by more than 20 points", () => {
  const ppl = [...mk(10, "Democratic", 2), ...mk(10, "Republican", 6)];
  const roles = ppl.map((p) => ({ person_id: p.id, state: p.state, type: p.type, end_date: null }));
  const { hide, chambers } = unevenChambers(ppl, roles, "2026-11-28");
  assert.equal(hide.size, 20);
  assert.deepEqual(chambers, [{ state: "CT", type: "lower", d: 20, r: 60 }]);
});
test("keeps photos within 20 points, or when a party has fewer than 5 members", () => {
  const close = [...mk(10, "Democratic", 5), ...mk(10, "Republican", 7)];
  const small = [...mk(2, "Democratic", 2, "upper", "WV"), ...mk(30, "Republican", 10, "upper", "WV")];
  const ppl = [...close, ...small];
  const roles = ppl.map((p) => ({ person_id: p.id, state: p.state, type: p.type, end_date: null }));
  assert.equal(unevenChambers(ppl, roles, "2026-11-28").hide.size, 0);
});
