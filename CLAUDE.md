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

## Data sources (verify each is current before building on it)
- Members, terms, IDs: unitedstates/congress-legislators (crosswalk of bioguide, FEC, etc.)
- Bills, sponsors, actions, CRS summaries: Congress.gov API
- Roll-call votes: House Clerk and Senate roll-call XML (or Congress.gov where available)
- Campaign finance: OpenFEC API
- Address → district: Geocodio (returns congressional district)

## Conventions
- Small, reviewable commits. Explain *why* in commit messages.
- Ingest jobs are idempotent (safe to re-run) and log what they changed.
- No committed build output (`dist/`), logs, zips, or progress files.
