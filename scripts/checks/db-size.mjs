// Weekly: fail (which opens a GitHub issue) when the database nears the free plan's 500 MB.
//   node scripts/checks/db-size.mjs
import { getClient } from "../ingest/lib.mjs";

const WARN_MB = 450;
const { data, error } = await getClient().rpc("database_size");
if (error) throw error;
const mb = Math.round(Number(data) / 1024 / 1024);
console.log(`Database size: ${mb} MB of 500 MB (warns at ${WARN_MB} MB)`);
if (mb >= WARN_MB) {
  console.error(`Database is ${mb} MB. Upgrade the Supabase plan or trim data before it reaches 500 MB, when writes stop.`);
  process.exit(1);
}
