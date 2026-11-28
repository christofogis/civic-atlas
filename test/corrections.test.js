import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCorrections, checkEntry, leadershipEntry } from "../lib/corrections.js";
import { correctionsMeta, matchPage } from "../lib/pageMeta.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../data/corrections/${f}`, import.meta.url), "utf8"));

test("every corrections log entry is complete, bilingual and sourced", () => {
  const all = buildCorrections(read("log.json"), read("leadership.json"));
  assert.ok(all.length >= 15);
  for (const e of all) assert.deepEqual(checkEntry(e), [], e.id);
  assert.equal(new Set(all.map((e) => e.id)).size, all.length, "ids are unique");
  for (let i = 1; i < all.length; i++) assert.ok(all[i - 1].date >= all[i].date, "newest first");
});

test("leadership corrections become one log entry per group, with upstream status", () => {
  const all = buildCorrections({ entries: [] }, read("leadership.json"));
  const e = all.find((x) => x.id === "house-gop-policy-chair-2026");
  assert.equal(e.cause, "upstream");
  assert.match(e.shown.en, /Kevin Hern was still shown as House Republican Policy Committee Chair and Jay Obernolte was not shown/);
  assert.match(e.now.en, /Jay Obernolte is shown from Apr 15, 2026/);
  assert.match(e.now.es, /desde el 15 abr 2026/);
  assert.equal(e.upstream.reported, null);
  assert.equal(e.upstream.retired, null);
  const retired = leadershipEntry("g", [{ action: "add", name: "A", title: "T", start_date: "2026-01-01", fixed_on: "2026-02-01", source: "https://x.gov/a", retired: "2026-03-01", reported_upstream: "https://github.com/x/1" }]);
  assert.equal(retired.upstream.retired, "2026-03-01");
  assert.equal(retired.upstream.reported, "https://github.com/x/1");
});

test("corrections page has its own preview tags", () => {
  assert.deepEqual(matchPage("/corrections"), { kind: "corrections" });
  const m = correctionsMeta({ url: new URL("https://x.dev/corrections?lang=es"), lang: "es", entries: [{ date: "2026-11-28" }] });
  assert.equal(m.canonical, "https://x.dev/corrections?lang=es");
  assert.match(m.description, /1 hasta ahora/);
});
