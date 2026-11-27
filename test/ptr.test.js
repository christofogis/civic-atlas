import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeEntities, parseSenatePtrHtml } from "../lib/ptr.js";

test("decodeEntities handles named, decimal and hex references", () => {
  assert.equal(decodeEntities("MH Four Winds LLC &nbsp;(New York, NY)"), "MH Four Winds LLC  (New York, NY)");
  assert.equal(decodeEntities("3M&#x27;s Partners &#39;A&#39; &amp; Co"), "3M's Partners 'A' & Co");
  assert.equal(decodeEntities("&amp;nbsp;"), "&nbsp;");
});

test("Senate PTR rows come out without HTML entities", () => {
  const html = `<table><thead></thead><tbody><tr><td>1</td><td>10/15/2026</td><td>Spouse</td><td>--</td>
    <td>MH Four Winds LLC <div class="text-muted">Company: MH Four Winds LLC &nbsp;(New York, NY)</div></td><td>Other</td>
    <td>Purchase</td><td>$1,001 - $15,000</td><td>Underlying asset of 3M&#x27;s Partners LLC</td></tr></tbody></table>`;
  const [r] = parseSenatePtrHtml(html);
  assert.equal(r.asset_name, "MH Four Winds LLC — Company: MH Four Winds LLC (New York, NY)");
  assert.equal(r.comment, "Underlying asset of 3M's Partners LLC");
  assert.equal(r.transaction_date, "2026-10-15");
  assert.equal(r.amount_min, 1001);
});
