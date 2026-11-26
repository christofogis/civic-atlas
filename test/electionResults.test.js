import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// The election results reader is Python (scripts/data/election_results.py); its parsing tests run here
// so `npm test` covers them. They read trimmed rows of the real sources, never the network.
test("election results parsing (FEC Federal Elections, House Clerk statistics)", () => {
  const r = spawnSync("python3", ["-B", "test/election_results_test.py"], { encoding: "utf8" });
  assert.equal(r.status, 0, (r.stdout || "") + (r.stderr || "") + (r.error ? String(r.error) : ""));
});
