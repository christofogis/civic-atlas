// Public, read-only connection details for the browser. The publishable key is designed
// to ship in client code: Row Level Security limits it to reading. Never put the
// service-role key or any other secret here.
export const SUPABASE_URL = "https://fkbzxaoeyrtzviyfzulq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_M_uX1gyqB4R-7cqapPLdTQ_D4lbhVdT";

// Cloudflare Turnstile site key (public by design). Empty = bot check not shown.
// The matching secret key lives only in the Pages project's environment variables.
export const TURNSTILE_SITE_KEY = "0x4AAAAAAGQEsAL9bIX9fYmK";
