// Shared helpers for ingest jobs. Server-side only: uses the service-role key.
import { createClient } from "@supabase/supabase-js";

export function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Read every row of a table, paging past PostgREST's 1,000-row default.
export async function fetchAll(db, table, columns, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

export async function upsertBatches(db, table, rows, onConflict, batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    for (let attempt = 1; ; attempt++) {
      const { error } = await db.from(table).upsert(rows.slice(i, i + batchSize), { onConflict });
      if (!error) break;
      // Gateway hiccups return an HTML page or a network error; upserts are safe to repeat.
      const transient = /^\s*<|fetch failed|timeout/i.test(error.message);
      if (!transient || attempt >= 4) throw new Error(`upsert ${table}: ${String(error.message).slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
}

// Record a run in ingest_runs so the site can show when data was last refreshed.
// Error text is public (ingest_runs is publicly readable), so never include secrets in it.
export async function withRun(db, job, fn) {
  const { data: run, error } = await db.from("ingest_runs").insert({ job }).select("id").single();
  if (error) throw new Error(`start run: ${error.message}`);
  try {
    const counts = await fn();
    await db.from("ingest_runs").update({
      status: "succeeded", finished_at: new Date().toISOString(), ...counts,
    }).eq("id", run.id);
    return counts;
  } catch (err) {
    await db.from("ingest_runs").update({
      status: "failed", finished_at: new Date().toISOString(), error: String(err.message).slice(0, 500),
    }).eq("id", run.id);
    throw err;
  }
}

// Stable comparison so unchanged rows are skipped (keeps updated_at meaningful).
export function changed(next, prev, fields) {
  return fields.some((f) => JSON.stringify(next[f] ?? null) !== JSON.stringify(prev[f] ?? null));
}
