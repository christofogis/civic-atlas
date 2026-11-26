import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// The California results reader is Python (scripts/data/ca_results.py); its parsing tests run here so
// `npm test` covers them. They read saved responses only, never the network.
test("California results parsing (SOS returns API, Statement of Vote)", () => {
  const r = spawnSync("python3", ["-B", "test/ca_results_test.py"], { encoding: "utf8" });
  assert.equal(r.status, 0, (r.stdout || "") + (r.stderr || "") + (r.error ? String(r.error) : ""));
});
