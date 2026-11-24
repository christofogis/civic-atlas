# Roadmap

## Phase 0 — Clean foundation
- [ ] Rotate every key that was in the old repo (Supabase, OpenAI, FEC, Geocodio, Google x2, OpenStates)
- [ ] New repo, Vite + React scaffold, Vercel project pointed at it
- [x] New Supabase project (old one was past restore window); RLS on all tables
- [ ] Confirm each data source in CLAUDE.md is live and its terms allow this use

## Phase 1 — Federal MVP
- [x] Schema written and tested locally: members, terms, districts, committees, bills, votes, vote_positions, finance_summaries, ingest_runs (keyed on bioguide_id)
- [x] Apply schema to Supabase (advisors clean)
- [x] Ingest: congress-legislators → members/terms (daily, GitHub Actions)
- [x] Ingest: committees and committee memberships (same daily workflow)
- [ ] Address lookup → your 2 senators + 1 representative
- [x] Ingest: roll-call votes (House + Senate), bills + cosponsors + CRS summaries (GovInfo), FEC totals
- [ ] Member profile page: bio, committees, sponsored bills, recent votes, FEC totals, source links
- [ ] Deploy publicly

## Phase 2 — Depth
- [ ] Vote ingest from House/Senate clerks; vote search by issue
- [ ] Bill pages with CRS summaries (AI summary only as labeled fallback)
- [ ] FEC detail: top contributors by industry/committee
- [ ] Scheduled refresh jobs + data-freshness indicator on each page

## Later
- State legislators (OpenStates), governors, then local
