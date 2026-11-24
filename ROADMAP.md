# Roadmap

## Phase 0 — Clean foundation
- [ ] Rotate every key that was in the old repo (Supabase, OpenAI, FEC, Geocodio, Google x2, OpenStates)
- [x] New repo, Vite + React scaffold
- [x] Cloudflare Pages project connected to the repo
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
- [x] Donors: contributions by size, donors' employers, top PACs (FEC has no industry codes)
- [x] Outside spending for / against
- [x] Lobbying on bills (LDA.gov LD-2 reports naming a bill; bill pages)
- [ ] Earmark requests (deferred Nov 2026: House publishes a consolidated requests .xlsx; the Senate
  has no consolidated list and appropriations.senate.gov blocks automated downloads)

## Phase 2 — Depth
- [x] Vote search by issue (/member/:id/votes; policy area of the bill each vote was on). Votes cover the 118th and 119th Congresses.
- [x] Bill pages with CRS summaries (AI summary only as labeled fallback; none generated yet)
- [x] FEC detail: donation sizes, donors' employers, PACs, outside spending (no industry codes: the FEC has none)
- [x] Scheduled refresh jobs + data-freshness indicator on each page

## Later
- State legislators (OpenStates), governors, then local

## Added Nov 24, 2026
- [x] Site header with search (members by name, bills by number or title)
- [x] Browse: /members by state, /bills by Congress and issue (sortable by lobbying)
- [x] /compare: how often two members cast the same vote, and where they differed
- [x] Bill pages: how every member voted on each roll call, counts by party
- [x] Committee pages with members and bills referred
- [x] 120th Congress transition prep (docs/transition-120th.md)
- [x] vote_positions stored against integer vote keys (153 MB -> 99 MB)
- [ ] Finance cycle picker (early 2027 pages will show the new 2028 cycle)
- [ ] Email alerts (needs a decision on accounts and an email provider)
- [x] Bill status bar from Library of Congress milestone codes
- [x] Tap-to-explain terms and /glossary
- [x] "At a glance" sentences on member pages (template, no AI)
- [x] /week: latest week with votes, laws, chamber passage, your reps' votes
- [x] Report an error on every page (error_reports, read in the Supabase dashboard)
- [ ] AI bill summaries: cheapest model, labeled, from official text only. Needs Chris to pick
      a provider, add the API key as a GitHub secret, and set a monthly spending cap
- [x] Contact box and official account links on member pages
- [x] Nightly browser check of key pages; failures and job failures open a GitHub issue
- [x] Coming up: House floor schedule, Senate convening, committee hearings/markups
- [x] Quiz: do you vote like your representatives? (fixed-rule bill selection)
- [x] Follow a member, bill or committee: RSS feeds and calendar subscriptions, no account
- [x] Topic pages (/topics); 2028 candidates from FEC filings (/elections)
- [ ] Installable app with notifications; Spanish
- [x] Design pass: party-neutral palette, Public Sans, member page tabs, scales with typical-member marker
- [x] Home page remembers your representatives (member IDs on the device only)
- [x] Public corrections log; weekly automated accuracy check shown on /methods
- [ ] Run the usability sessions (kit in Claude Docs: "Civic Atlas usability test kit")
