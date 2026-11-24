import { PostgrestClient } from "@supabase/postgrest-js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

// Read-only database access for the browser. Only the REST client is needed (no sign-in,
// storage or realtime), which keeps the download small. The publishable key is public by design.
export const db = new PostgrestClient(`${SUPABASE_URL}/rest/v1`, {
  headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
});
