# Switching to the 120th Congress (Jan 3, 2027)

What changes on its own, what to watch, and what to check. Rehearsed Nov 24, 2026 by running
the `seat_holders` logic as of 2027-01-04 with two invented incoming terms: their seats showed
as `serving`, and every seat without a new term showed as `pending_update`.

## Changes on their own
- **Address lookup** asks Geocodio for `cd120` from Jan 3 (Eastern time) instead of `cd119`
  (`lib/congress.js`), so the district map can't switch ahead of or behind the date.
  Geocodio's `cd120` already has the redrawn maps for CA, TX, MO, NC, OH and UT.
- **Seats**: every House term and 33 Senate terms end 2027-01-03. Until congress-legislators
  publishes the new terms (usually within a day or two), those seats are `pending_update`
  and lookups say "new term began; data updating" instead of naming the previous holder.
  After 30 days without a new term a seat drops out of `seat_holders` entirely.
- **Votes and bills** jobs pick up the 120th from the `congresses` table; lobbying reports
  from 2027 map to the 120th.
- **Committee assignments** are kept as the 119th's until `committee-membership-current.yaml`
  changes after Jan 3 (committees organize weeks later), so old assignments are never
  labeled as the 120th's.
- **Bills and committee pages** default to the Congress in session by date.

## Check on Jan 4–6
1. `select seat_status, count(*) from seat_holders group by 1;` should move from mostly
   `pending_update` to `serving` as congress-legislators updates.
2. Look up an address in a redrawn state (e.g. Los Angeles, Austin) and one elsewhere; the
   House seat should name the new member, never the previous holder of that number.
3. `ingest_runs`: members, committees ("not yet updated" is expected), votes-120, bills.
4. New members' pages: FEC totals appear after the next weekly FEC run.

## Known gaps
- No "incoming members" page: no official machine-readable list of members-elect is
  published before they're sworn in.
- Finance detail switches to the 2028 cycle once members report 2028 receipts, so early-2027
  pages show small new-cycle numbers. A cycle picker would help.
