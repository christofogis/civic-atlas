// Weekly: fail (which opens a GitHub issue) when the database nears the plan's included disk.
// Supabase Pro (from Nov 25, 2026) includes 8 GB; past that, extra disk is billed, so warn at 6 GB.
//   node scripts/checks/db-size.mjs
import { getClient } from "../ingest/lib.mjs";

const INCLUDED_MB = 8192;
const WARN_MB = 6144;
const { data, error } = await getClient().rpc("database_size");
if (error) throw error;
const mb = Math.round(Number(data) / 1024 / 1024);
console.log(`Database size: ${mb} MB of ${INCLUDED_MB} MB included (warns at ${WARN_MB} MB)`);
if (mb >= WARN_MB) {
  console.error(`Database is ${mb} MB. Trim data or plan for extra disk before it passes ${INCLUDED_MB} MB, which is billed.`);
  process.exit(1);
}
