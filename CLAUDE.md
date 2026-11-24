# Civic Atlas

An "IMDb for politicians": a citizen enters an address and sees who represents them, then
drills into each official's record — votes, sponsored bills, committees, and money — drawn
from primary sources and described in neutral language.

Owner: Chris (christofogis). Solo project. Claude acts as a critical thinking partner, not a
yes-man: flag weak ideas, scope creep, and shortcuts that will cost later.

## Editorial rules (non-negotiable)
- Neutral, descriptive language. No adjectives that judge ("extreme", "bipartisan hero").
- Every fact on a page links to its primary source (Congress.gov, FEC, House/Senate clerks).
- AI-generated text (bill summaries) is labeled as such, links to the official text, and never
  characterizes intent or impact. Prefer CRS summaries from Congress.gov when they exist.
- Treat every party and official identically in layout, wording, and data coverage.

## Scope
- **Milestone 1 is federal only**: 535 members of Congress, keyed on `bioguide_id`.
- State and local officials come later. Do not build for them yet.

## Stack
- Frontend: React + Vite, hosted on Cloudflare Pages (free plan; static assets unlimited).
- Backend: Cloudflare Pages Functions in `/functions` (e.g. `functions/api/lookup.js` →
  `/api/lookup`). Keyed third-party calls (Geocodio) happen here; keys live in the Pages
  project's environment variables, never in GitHub. Free plan: 100k requests/day, 10 ms CPU.
- Ingest jobs run in GitHub Actions, not on the host (see below).
- Database: Supabase (Postgres). Scheduled ingest jobs write to it; the site reads from it.
  The site should not call upstream APIs on every page view.

## Security rules
- No secrets in the repo, ever. `.env` is gitignored; `.env.example` lists names only.
- Server-only secrets never use the `VITE_` prefix (Vite exposes `VITE_*` to the browser).
- No API calls to OpenAI or other keyed services from the browser.
- Google Maps/Places browser keys must be restricted by HTTP referrer in Google Cloud.
- `/api/lookup` requires a Cloudflare Turnstile token once `TURNSTILE_SECRET_KEY` is set in
  Pages; the public site key is `TURNSTILE_SITE_KEY` in `src/lib/config.js`. Set the site key
  first, then the secret, or lookups will be refused.
- Supabase: Row Level Security on every table; the browser gets read-only access via the
  publishable key, which is committed in `src/lib/config.js` by design. The service-role
  key is used only in ingest jobs (GitHub secret).

## Data sources (checked Nov 2026)
- Members, terms, IDs: unitedstates/congress-legislators (public domain; crosswalk of
  bioguide, FEC, GovTrack, etc.)
- Bills, sponsors, cosponsors, CRS summaries: GovInfo Bill Status bulk data (official record
  behind Congress.gov; no key, no rate limit; daily runs read only files modified since the
  last success). Don't page Congress.gov's per-member lists: deep pages take ~8s each.
- Roll-call votes: House Clerk XML and senate.gov XML (no key). The Clerk returns an ordinary
  page, not a 404, past the last roll number. Speaker elections record candidate names.
- Campaign finance: OpenFEC API (~1,000 calls/hour with the `DATA_GOV_API_KEY`; runs weekly). FEC rules bar using
  individual contributor names for solicitation or commercial purposes — display is fine.
- Stock trades: House Clerk FD index ({year}FD.zip) + PTR PDFs (pdftotext -layout), and
  Senate eFD (public-use agreement accepted automatically, authorized by Chris for free,
  non-commercial use). 5 U.S.C. § 13107 bars commercial use of this data other than news
  media dissemination — no paid tiers or paid APIs built on it. Scanned filings: link only.
- Address → district: Geocodio `cd` field (free tier 2,500 lookups/day). Results may be stored.
- Do not use: ProPublica Congress API (no new keys issued). Prefer the official sources above
  over third-party aggregators.

## Congress transitions
- The 120th Congress convenes Jan 3, 2027. Several states redrew districts mid-decade
  (incl. CA, TX, OH, NC, MO, UT). Districts, votes, bills, and committee seats carry a
  `congress` number; terms carry dates (a Senate term spans three Congresses) and map to
  Congresses via the `term_congresses` view. Never assume "current" is fixed. Geocodio's
  `cd` default flips to the 120th on Jan 3, 2027.

## Database
- Schema lives in `supabase/migrations/`. Change it only by adding a new migration file.
- Party is snapshotted on each term and each vote position, so party switches don't
  rewrite history. Clerk wording (`position`, `question`, `result`) is stored verbatim.
- User addresses are never stored.
- Address lookup reads `seat_holders`, not `current_terms`. A `pending_update` seat must be
  shown as "new term began; data updating", never as the current representative — after
  redistricting the previous holder may have represented a different area.

## Ingest jobs (GitHub Actions, `scripts/ingest/`)
- Daily: members + committees 4:17am PT, votes 4:47am, bills 5:23am, trades 5:53am.
  FEC totals weekly Tue evening, FEC detail (sizes, employers, PACs, outside spending) Wed
  evening (~3 hours, paced under the API limit). Vote and bill stats are recomputed in the database after their jobs.
- Coverage starts with the 118th Congress (2023). Members include anyone who served since then.
- Every run is logged in `ingest_runs` (public); never put secrets in error text.

## Conventions
- Small, reviewable commits. Explain *why* in commit messages.
- Ingest jobs are idempotent (safe to re-run) and log what they changed.
- No committed build output (`dist/`), logs, zips, or progress files.
