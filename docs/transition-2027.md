# Transition checklist: Dec 7, 2026 and Jan 3, 2027

What changes, what the site does on its own, and what to check by hand. Background:
`docs/jan-3-transition.md` and `docs/transition-120th.md`. Rehearsal: `npm test`
(`test/transition2027.test.js`, `test/stateleg.calendar.test.js`) and the probe
`scripts/probe/transition_2027.py`, which renders this branch with the clock set to Jan 4, 2027.

## Automatic

| When | What | How the site handles it |
|---|---|---|
| Dec 7, 2026 | California Assembly (80) and even-numbered Senate seats (20) begin new terms (Cal. Const. art. IV, sec. 2(a)) | `lib/stateleg.js` calendar: those seats show "New term began Dec 7, 2026; data updating" with the official roster link, on lookups and state person pages, until Open States lists someone whose role starts on or after Dec 7 in that chamber. Then the listed holders show again (re-elected members keep their old role in Open States). |
| Dec 15, 2026 | Husted's appointment ends (Ohio, class 3) | Seat shows "new term began; updating" until Sherrod Brown's term is in congress-legislators. |
| Jan 3, 2027 (Eastern) | 120th Congress: House terms and 33 Senate terms end | `seat_holders`: those seats are `pending_update`; lookup, member pages, embed, members list and map say "data updating", never the previous holder as serving. |
| Jan 3 | New lines in AL, CA, FL, LA, NC, OH, TN, TX, UT | Lookup asks Geocodio for `cd120`; map defaults to 120th lines. Party colors and hover names apply to current lines only. |
| Jan 3 | 119th leadership posts | No longer current (posts are per Congress). Leadership page says the 120th's aren't in the source yet and links house.gov / senate.gov. Committee leaders are labeled as the 119th's. |
| Jan 3–24 | First roll calls (Speaker election) | Votes job runs both Congresses for 7 days and re-reads the 120th from roll call 1 for 21 days, so positions of members added late are filled in. |
| Jan 3 | Bills default to the 120th | Empty list says no 120th bills yet, links the 119th. 119th bills still pending read "ended". |
| Jan 3 | On the ballot | Defaults to 2028. The 2026 tab shows outcomes per chamber only once that chamber's new terms are in the data. |
| Jan 3 | Status page | Vote job row follows the Congress (`votes-120`). |
| Jan 4 | CA governor and statewide terms (Open States end date 2027-01-04) | End dates are read as the first day not served: shows "being updated" from Jan 4 until Open States adds the new officials. |

## Watch by hand

**Before Dec 7**
- [ ] Probe run green (`inputs[script]=transition_2027.py`).

**Dec 7–14**
- [ ] Look up an Orange County address: Assembly 72 and Senate 36 show "New term began Dec 7, 2026".
- [ ] When Open States updates California (`state_roles` with `start_date >= 2026-12-07`), the holders reappear. If only some new members are added, check that no departing member still shows: the chamber counts as updated once anyone starts with the new term.
- [ ] After certification (Dec 11), California winners may be named on these cards only if `ca-results-2026.json` gains legislative races with certified status. Today it has none (status semi-official).

**Jan 3–6**
- [ ] `select seat_status, count(*) from seat_holders group by 1;` moves from `pending_update` to `serving`.
- [ ] congress-legislators adds 120th leadership (House: GOP becomes the minority; Jim Jordan reported elected Republican leader, Axios Nov 10). No correction is added for it: corrections need an official source (house.gov/leadership).
- [ ] Ohio class 3: Brown's term appears. **If a seat's new term isn't in the data within 30 days, the seat drops out of `seat_holders` and the lookup shows no card for it.**
- [ ] `ingest_runs`: `votes-119` (catch-up) and `votes-120` succeed; members job succeeds.
- [ ] `public/data/us-control.json`: add the 120th's majorities (manual, see jan-3-transition.md).

**Jan 5–24**
- [ ] Committees switch to the 120th once the source file changes.
- [ ] Per-Congress attendance on member pages starts from a handful of votes. Honest, but thin for the first weeks.

## Known gaps
- Calendar rules exist for California only. In other states, a seat goes to "updating" only where Open States gives an end date (a few in AZ, IA, MI, NE, UT, ID, CO today). Elsewhere a defeated incumbent stays listed until Open States updates the state. Each new state rule needs its constitutional citation.
- The state person page's search-result and meta descriptions still name the office from Open States as-is.
- The `state_officeholders` view (no longer used by the lookup) still reads end dates as inclusive.
