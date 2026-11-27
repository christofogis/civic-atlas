// Public, read-only connection details for the browser. The publishable key is designed
// to ship in client code: Row Level Security limits it to reading. Never put the
// service-role key or any other secret here.
export const SUPABASE_URL = "https://fkbzxaoeyrtzviyfzulq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_M_uX1gyqB4R-7cqapPLdTQ_D4lbhVdT";

// Cloudflare Turnstile site key (public by design). Empty = bot check not shown.
// The matching secret key lives only in the Pages project's environment variables.
export const TURNSTILE_SITE_KEY = "0x4AAAAAAGQEsAL9bIX9fYmK";

// Google Places browser key for address suggestions (public by design; it ships to every
// visitor). It must be restricted in Google Cloud to HTTP referrers civic-atlas-cub.pages.dev/*
// (plus any custom domain) and to the Places API (New) only, with a daily quota cap.
// Empty = plain address box, no suggestions.
export const GOOGLE_PLACES_KEY = "";

// Optional accounts (Supabase Auth). Off until the accounts migration is applied and the Supabase
// dashboard is set up (docs/accounts-setup.md): Site URL, redirect URLs, email sign-in.
// Off = no Sign in link, no Save buttons; the site works the same either way.
export const ACCOUNTS_ENABLED = false;
// Google sign-in button. Turn on only after the Google OAuth client exists and its IDs are in the
// Supabase dashboard (Authentication > Sign In / Providers > Google).
export const AUTH_GOOGLE_ENABLED = false;
