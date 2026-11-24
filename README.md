# Civic Atlas

Enter an address and see who represents you in Congress, with their votes, bills, committees,
money and lobbying, from official sources and in plain language. Live at
https://civic-atlas-cub.pages.dev. Project rules and data sources are in `CLAUDE.md`; plans are
in `ROADMAP.md`.

## How it fits together
- **Site**: React + Vite in `src/`, hosted on Cloudflare Pages. Every push to `main` deploys.
  `functions/api/lookup.js` turns an address into districts (Geocodio) and representatives.
- **Database**: Supabase Postgres. Schema changes are files in `supabase/migrations/`.
  The browser reads it with the publishable key (read-only by row-level security).
- **Data jobs**: `scripts/ingest/`, run on a schedule by GitHub Actions (`.github/workflows/`).
  Each run is logged in the `ingest_runs` table.
- **Shared code**: `lib/` (parsers used by both the jobs and the site), tested in `test/`.

## Everyday tasks
- **Re-run a data job**: GitHub → Actions → pick the job → Run workflow. Jobs are safe to re-run.
  Useful inputs: votes `congress`; bills `full` (re-read every bill); lobbying `quarters`
  (e.g. `2026-3`); trades `full`; FEC detail `probe` (one candidate, nothing written).
- **When something fails**: a GitHub issue named "Failed: <job>" opens automatically and links
  to the run log. The nightly **Site check** opens the live pages in a browser and fails if
  any shows an error or is missing content.
- **Error reports from visitors**: Supabase → Table editor → `error_reports`. Set `status` to
  `fixed`, `not_an_error` or `duplicate` when handled.
- **Publishing a correction**: when a report turns out to be a real error in the data, fix it,
  then add a row to `corrections` (Supabase → Table editor) saying what was wrong and what
  changed. It appears on /corrections.
- **Secrets**: GitHub → Settings → Secrets → Actions (`SUPABASE_SERVICE_ROLE_KEY`,
  `DATA_GOV_API_KEY`, `LDA_API_KEY`). Cloudflare Pages → Settings → Variables
  (`GEOCODIO_API_KEY`, `TURNSTILE_SECRET_KEY`). After changing a Cloudflare variable, redeploy.
- **January 3, 2027**: see `docs/transition-120th.md`.

## Local development
```
npm ci
npm test            # parser tests
npm run dev         # site at http://localhost:5173 (the /api/lookup function needs Cloudflare)
node scripts/checks/site.mjs   # check the live site's pages (needs: npx playwright install chromium)
```
