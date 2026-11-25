# January 3, 2027: the 120th Congress begins

What changes, what the site does on its own, and what to check. Rehearsed nightly by
`scripts/checks/transition.mjs` (in the site check), which looks up addresses as of Jan 2 and Jan 3.

## What happens on its own

| When | What | How the site handles it |
|---|---|---|
| Jan 3 (Eastern) | 435 House terms and 33–35 Senate terms end; new terms begin | Seats whose term ended show "A new term began… being updated" until the source adds the new terms. Nobody whose term ended is shown as serving (`seat_holders`, `member_directory`). |
| Jan 3 | New district lines take effect in AL, CA, FL, LA, NC, OH, TN, TX, UT | The lookup asks Geocodio for 120th Congress districts from Jan 3 (`congressOn`). Rehearsal: Los Alamitos moves from CA-45 to CA-41. The map's default switches to the 120th lines; 119th becomes "Previous lines". |
| Jan 3–6 | unitedstates/congress-legislators adds the new terms (usually within a day) | The members job runs hourly Jan 3–6. |
| Jan 3 onward | Committee assignments for the 120th aren't published for days or weeks | The committees job keeps the 119th's until the source file changes. |
| Jan 3 | First roll call is the Speaker election | Votes job picks up the 120th Congress, session 1; Speaker votes record candidate names. |
| Jan 3 onward | Visitors with a remembered lookup or a saved link from the 119th | Home page asks them to look up again; saved links drop the House member and say why. |

## Checklist

**Before (December)**
- [ ] Nightly site check green, including "Congress transition rehearsal".
- [ ] Orange County supervisors (Districts 2, 4, 5; new terms Jan 4) and Los Alamitos Districts 4–5 and mayor (December) updated in `public/data/local/ca-orange.json`.
- [ ] California statewide offices and Board of Equalization (new terms Jan 4) updated in `public/data/state/ca-statewide.json` from the Secretary of State's certified Statement of Vote (around Dec 11), then `seat_change_by` set to the next change.

**Jan 3–4**
- [ ] `public/data/us-control.json` (budget page, who held office): end the 119th Congress segments on 2027-01-03 and add the 120th's House and Senate majorities from the House Historian's and Senate's party division pages.
- [ ] `/status`: no job marked late or stopped.
- [ ] `ingest_runs`: members job succeeding hourly; count of House seats "updating" falling to near zero.
- [ ] Look up 3191 Katella Ave, Los Alamitos: CA-41 and its new member.
- [ ] Three freshman member pages load (photo, contact, committees may be empty).
- [ ] Map: CA district 41 panel shows the new member.

**Jan 5–10**
- [ ] Committee assignments switch to the 120th when the source updates.
- [ ] Run the accuracy check by hand once.
