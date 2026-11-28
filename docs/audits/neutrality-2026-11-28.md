# Neutrality and equal-treatment audit, Nov 28, 2026

Covers the 119th Congress data in Supabase as of the night of Nov 27–28, 2026. Read-only except the
eight AI summary rows sent back for a rewrite (section 1).

## 1. AI-written text

Scanned every published row: 332 plain summaries (lead + points, EN/ES), 229 simple summaries
(EN/ES) and 2,699 section summaries (EN/ES).

| Check (deterministic first, then read against the source) | Hits | Confirmed problems |
|---|---|---|
| Judging/rating words, EN (~90 terms) and ES (~70 terms) | 1,400+ word hits | 0. Nearly all are terms the source uses ("critical minerals", "small business", "major disaster", "vital national security interest"). |
| Intent/impact phrasing ("aims to", "to help", "helps", "benefits", "so that", "seek to") | 36 plain/simple rows where the word is not in the CRS text | 1: simple H.R. 2913 "This bill helps Ukraine" (CRS: "providing assistance to"). The rest restate purposes CRS reports ("plan to improve placement stability"), or "help" as an object ("expands help for family caregivers"). |
| Analogies ("like a", "similar to", "as if", "imagine") | 30 | 0. All are legal phrasing ("similar to those under the Foreign Service Act", "as if the phase-out never applied"). |
| Meta-commentary about the source ("the summary given ...", "does not mention") | 1 | 1: simple S. 1318 opened with "The summary given for S. 1318 does not mention servicemembers or religious heritage." (The bill's title is from an earlier text; the CRS summary is of a FISA/CBDC substitute.) |
| Singling out: rule resolutions and lists of bill numbers (CRS names N, AI names 1..N-1) | 6 plain rows | 2: H.Res. 951 (points name 5 of 6 bills, H.R. 4371 left out); H.Res. 1275 (lead names 3 of 5 measures). Lead-only singling in H.Res. 1131 is covered by its points (all four named), left as is. All simple summaries of rule resolutions were already flagged before this audit. |
| Bill-title wording used as the AI's own description | found while reading the rule resolutions | 4 plain rows: H.Res. 780 ("a bill to advance policy priorities that will break the gridlock"), 953 ("to ensure access to affordable health insurance"; "genital and bodily mutilation and chemical castration of minors", while CRS's own summary of H.R. 3492 calls it gender-affirming care), 1042 ("to modernize Federal firearms laws"), 1423 ("to improve veterans benefits"). 951 has the same problem too. CRS prints these as titles; without that framing they read as the site's own claims. |
| Numbers, dates and dollar amounts in AI text that are not in the CRS summary | 0 of 561 plain/simple rows | 0 |
| EN/ES mismatch in numbers, dates and dollar amounts | 27 bill rows, 14 section rows | 0. All are formatting ("$1 billion" / "$1,000 millones"), act years the Spanish spells out ("Ley ... de 1970"), or "millas" read as "mil". |

Section summaries can't be compared with their section text here (the text lives in GovInfo XML,
not in the database), so for sections only the word, phrasing and EN/ES checks ran. Read in
context, every hit restates the statute ("certifies the projects as important to the national
defense"). None was flagged.

**Sent back for a rewrite** (status `flagged`, `published = false`, `attempts = 1`, `check_notes`
naming the problem):

| Table | Measure | Problem |
|---|---|---|
| plain | H.Res. 951 | Singling out (5 of 6 bills); NEPA bill's purpose-stating title used as a description |
| plain | H.Res. 1275 | Singling out (3 of 5 measures) |
| plain | H.Res. 780 | Title claim "will break the gridlock" used as a description |
| plain | H.Res. 953 | Titles' wording used as descriptions (two bills) |
| plain | H.Res. 1042 | Purpose-stating titles used as descriptions |
| plain | H.Res. 1423 | Purpose-stating title used as a description |
| simple | S. 1318 | Comments on the source instead of describing the measure |
| simple | H.R. 2913 | "helps Ukraine": states an effect; CRS says "provides assistance" |

**Prompt change (this branch):** the writer and checker for both summary levels now say that a
bill's official title may state a purpose or a claim, and that it is given in quotation marks as a
title or not at all. Without this, rewrites of rule resolutions would keep repeating titles.

## 2. Equal treatment by party

Party is the sponsor's party on the day the bill was introduced (`party_on`). 119th Congress.

### Bill summaries

| Metric | R | D | Gap | Cause |
|---|---|---|---|---|
| Bills / bills with a CRS summary | 10,206 / 3,836 | 10,014 / 2,576 | | source |
| Plain summary rows | 319 | 81 | | scope: bills with a floor vote, laws, recent movement, upcoming hearings. The majority sets the floor agenda, and every special rule is a majority-sponsored H.Res. (42 R, 9 D H.Res. rows). |
| In-scope bills (vote or law) with CRS that have a row | 66.4% | 61.3% | 5.1 pp | backlog, not party: bills that moved in 2026 are 100% / 99.2% covered for both; the gap is all in 2025 bills (27.4% vs 20.7%), which the job reaches newest first at 100 a run. Closes as the backlog clears. |
| Published share of rows (plain) | 81.5% | 81.5% | 0 | |
| Held rate (plain) | 16.9% | 17.3% | 0.4 pp | |
| Simple summary coverage of published plain | 69.6% | 69.7% | 0.1 pp | |
| Avg plain summary length (chars, lead + points) | 431 | 352 | 79 chars | source: R-sponsored CRS summaries are longer (median 908 vs 530 chars). Compared within the same CRS length band they match (250–1,000 chars: 355 vs 374; >1,000: 573 vs 529). |
| Avg simple summary length (chars) | 251 | 247 | | |
| Section summaries: bills / sections / held rate | 104 / 2,871 / 7.3% | 15 / 43 / 11.6% | | scope is enacted text, mostly majority bills; D sample (5 held of 43) too small to read as a gap. |

### Members (current terms)

| % with | House R (221) | House D (217) | Senate R (53) | Senate D (45) | Gap > 5 pp? | Cause |
|---|---|---|---|---|---|---|
| Portrait (unitedstates/images 225x275) | 97.7 | 96.8 | 94.3 | 100 | Senate 5.7 pp (3 people) | source: the images repo has no photo for 15 newer members (8 R, 7 D: Begich, Barrett, Bell, Husted, Walkinshaw, Grijalva, Van Epps, Menefee, Armstrong, Fuller, Mejia, Gallagher, Graham Nordone, Blair, Wahab). Same rule for everyone. |
| FEC candidate IDs / finance summary | 100 / 100 | 100 / 99.5 | 96.2 / 96.2 | 100 / 100 | no | Two recent R Senate appointees and one D House special-election winner have no FEC committee yet |
| PTR filings / trade rows | 37.1 / 32.6 | 27.2 / 25.3 | 43.4 / 43.4 | 24.4 / 24.4 | yes (7–19 pp) | source: who filed periodic transaction reports. No unmatched filers saved, both chambers keep scanned/paper filings as link-only, and no electronic filing has zero parsed rows. |
| Committee seats (119th) | 99.1 | 98.2 | 100 | 100 | no | |
| Current leadership line | 2.3 | 2.3 | 13.2 | 22.2 | Senate 9 pp | source: each caucus has its own number of elected leadership posts (7 R, 10 D) |
| Vote stats / bill stats | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 | no | |

### State officials' photos (Open States image link)

| | R | D | Other |
|---|---|---|---|
| Active people | 4,120 | 3,329 | 169 |
| Any photo | 87.1% | 84.0% | 65.7% |
| Expected from state mix | 86.6% | 84.7% | 67.3% |
| Photo on a government host (.gov, .us) | 66.0% | 65.1% | 56.2% |

The national gap (3.1 pp) is the mix of states. But **within some chambers the gap is large and
it comes from the source**: Indiana House D 7% vs R 100% (R photos come from the House Republican
caucus site and campaign sites; Open States has none for most Democrats), Connecticut House D 35%
vs R 94%, Connecticut Senate D 28% vs R 82%, West Virginia Senate R 44% vs D 100% (2 D). About 20%
of all state photo links point to campaign sites, caucus sites (indianahouserepublicans.com,
senatedems.com, misenategop.com), news CDNs, Wikimedia or Google image thumbnails
(encrypted-tbn0.gstatic.com), not to the official site the photo rule assumes. Needs Chris's
decision (below). Nothing changed.

## 3. Interface text (src/)

Searched English and Spanish strings for judging adjectives (~80 terms in both languages), loaded
words ("dark money", "special interests", "no-show") and framing words ("despite", "merely", "as
many as"), and read every string that names a party, majority or minority. No changes needed:

- Matches are HTML (`<strong>`), React `key`, code comments, or official terms ("Failed",
  "Absent", OMB's "Historical Tables").
- Party wording is symmetric: the party-line sentences build both parties from one template
  ("voted with the Democratic/Republican side", "la mayoría demócrata/republicana", with the right
  gender in Spanish). Parties are listed D then R everywhere (alphabetical) with the letter shown.
- Glossary entries that mention the minority (previous question, motion to recommit) describe a
  procedure, not a party.

## Needs Chris

1. **State photos.** Within Indiana, Connecticut and a few other chambers, one party has photos
   and the other mostly doesn't, and about a fifth of the links are campaign, caucus, news or
   Google-thumbnail images. Options: (a) keep only links on the legislature's or state's own
   domain (about 66% coverage for both parties; caucus sites would go too); (b) hide photos for a
   whole chamber when its coverage differs between parties by more than a set amount; (c) leave as
   is. I'd pick (a) with an allowlist per state; it matches the Nov 26 photo rule.
2. **Rule-resolution titles.** The prompt change asks for titles in quotation marks. If you'd rather
   rule summaries never repeat long titles at all (only bill numbers and neutral topics), say so
   and the wording can be tightened.
3. **2025 backlog.** About 190 in-scope 2025 bills with CRS summaries have no plain summary yet; the
   5 pp party gap closes once they're done. A one-time `--limit` run would finish them in a few
   nights.
