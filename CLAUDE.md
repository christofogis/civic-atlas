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
- Frontend: React + Vite, deployed on Vercel.
- Backend: Vercel serverless functions in `/api`. All third-party API calls happen here.
- Database: Supabase (Postgres). Scheduled ingest jobs write to it; the site reads from it.
  The site should not call upstream APIs on every page view.

## Security rules
- No secrets in the repo, ever. `.env` is gitignored; `.env.example` lists names only.
- Server-only secrets never use the `VITE_` prefix (Vite exposes `VITE_*` to the browser).
- No API calls to OpenAI or other keyed services from the browser.
- Google Maps/Places browser keys must be restricted by HTTP referrer in Google Cloud.
- Supabase: Row Level Security on every table; the browser gets read-only access via the
  publishable key. The service-role key is used only in server functions and ingest jobs.

## Data sources (checked Nov 2026)
- Members, terms, IDs: unitedstates/congress-legislators (public domain; crosswalk of
  bioguide, FEC, GovTrack, etc.)
- Bills, sponsors, actions, CRS summaries: Congress.gov API (free api.data.gov key)
- House roll-call votes: Congress.gov `/house-vote` (beta, 118th Congress onward) or House
  Clerk XML. Senate roll-call votes: senate.gov XML — Congress.gov has no Senate vote endpoint.
- Campaign finance: OpenFEC API (~1,000 calls/hour with a key). FEC rules bar using
  individual contributor names for solicitation or commercial purposes — display is fine.
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

## Conventions
- Small, reviewable commits. Explain *why* in commit messages.
- Ingest jobs are idempotent (safe to re-run) and log what they changed.
- No committed build output (`dist/`), logs, zips, or progress files.
