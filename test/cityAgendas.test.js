import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// The city agenda reader is Python (scripts/data/city_agendas.py); its parsing tests run here so
// `npm test` covers them. They read saved responses only, never the network.
test("city agenda parsing (Legistar and CivicClerk)", () => {
  const r = spawnSync("python3", ["-B", "-m", "unittest", "-v", "test/city_agendas_test.py"], { encoding: "utf8" });
  assert.equal(r.status, 0, (r.stdout || "") + (r.stderr || "") + (r.error ? String(r.error) : ""));
});
