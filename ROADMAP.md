# Roadmap

## Phase 0 — Clean foundation
- [ ] Rotate every key that was in the old repo (Supabase, OpenAI, FEC, Geocodio, Google x2, OpenStates)
- [x] New repo, Vite + React scaffold
- [ ] Cloudflare Pages project connected to the repo
- [x] New Supabase project (old one was past restore window); RLS on all tables
- [ ] Confirm each data source in CLAUDE.md is live and its terms allow this use

## Phase 1 — Federal MVP
- [x] Schema written and tested locally: members, terms, districts, committees, bills, votes, vote_positions, finance_summaries, ingest_runs (keyed on bioguide_id)
- [x] Apply schema to Supabase (advisors clean)
- [x] Ingest: congress-legislators → members/terms (daily, GitHub Actions)
- [x] Ingest: committees and committee memberships (same daily workflow)
- [x] Address lookup → your 2 senators + 1 representative (Geocodio via Pages Function)
- [x] Ingest: roll-call votes (House + Senate), bills + cosponsors + CRS summaries (GovInfo), FEC totals
- [x] Member profile page: service, committees, recent votes, sponsored bills, FEC totals, source links
- [ ] Deploy publicly

## Phase 1b — Accountability metrics
- [x] Party-line rate on party-split votes, with chamber medians
- [x] Missed-vote rate
- [x] Methods page (/methods)
- [x] Label procedural vs. final votes (src/lib/voteKind.js), with "final votes only" filter
- [x] Bipartisan cosponsorship: cross-party cosponsorship and cross-party support rates
- [ ] Members' statements beside their votes

## Phase 1c — Money & conflicts
- [x] Stock trades (STOCK Act PTRs, House + Senate, 2025 on) with 45-day timing
- [ ] Donors by industry and PAC
- [ ] Outside spending for / against
- [ ] Lobbying on bills
- [ ] Earmark requests

## Phase 2 — Depth
- [ ] Vote ingest from House/Senate clerks; vote search by issue
- [ ] Bill pages with CRS summaries (AI summary only as labeled fallback)
- [ ] FEC detail: top contributors by industry/committee
- [ ] Scheduled refresh jobs + data-freshness indicator on each page

## Later
- State legislators (OpenStates), governors, then local
