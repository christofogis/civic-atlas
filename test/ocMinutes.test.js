import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// The Board minutes reader is Python (scripts/data/oc_minutes.py); its parsing tests run here so
// `npm test` covers them. Text only, never the network.
test("Orange County Board minutes parsing", () => {
  const r = spawnSync("python3", ["-B", "test/oc_minutes_test.py"], { encoding: "utf8" });
  assert.equal(r.status, 0, (r.stdout || "") + (r.stderr || "") + (r.error ? String(r.error) : ""));
});
