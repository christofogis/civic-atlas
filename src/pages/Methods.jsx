import { useEffect } from "react";
import AccuracyStatus from "../components/AccuracyStatus.jsx";
import { Link, useLocation } from "react-router-dom";
import { getLang } from "../lib/lang.js";
import MethodsEs from "./MethodsEs.jsx";

// How every number on the site is produced. Keep this in step with the code:
// supabase/migrations/*_member_vote_stats.sql and scripts/ingest/*.
export default function Methods() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  if (getLang() === "es") return <MethodsEs />;
  return (
    <main className="page prose">
      <h1>How this site works</h1>
      <p className="lede">
        Every figure here comes from official public records, is calculated the same way for every
        member of Congress, and links back to its source. This page explains how.
      </p>

      <h2>Party-line rate</h2>
      <p>
        A <strong>party-split vote</strong> is a roll call where a majority of the Democrats who voted
        and a majority of the Republicans who voted took opposite sides. Votes without a yes-or-no
        choice, such as quorum calls and the election of the Speaker, never count.
      </p>
      <p>
        A member's <strong>party-line rate</strong> is the share of their yes-or-no votes on party-split
        roll calls that matched their own party's majority. Missed votes and "present" votes are left
        out. Independents are compared with the party they caucus with, as recorded in the
        congress-legislators dataset.
      </p>
      <p>
        Only party-split votes are used because most roll calls in Congress are not contested along party
        lines; counting every vote would make nearly every member look alike. This follows the long-standing
        "party unity" approach used by congressional researchers.
      </p>
      <p>
        A high or low rate is not a judgment. It describes how often a member's votes matched their
        party's majority, nothing more. The rate isn't shown for fewer than 20 party-split votes.
      </p>

      <h2>Missed-vote rate</h2>
      <p>
        The share of roll calls held in the member's chamber while they served where the clerk recorded
        them as "Not Voting." Absences can have many causes, including illness, family matters and
        campaigning; the records don't say which.
      </p>

      <h2>Chamber medians</h2>
      <p>
        Shown for context: half of the chamber's members are above the median and half below.
        Members with fewer than 50 roll calls in a Congress are left out. Delegates and the Resident
        Commissioner can vote only on certain amendment votes, so their figures are not compared
        with the chamber.
      </p>

      <h2 id="cosponsorship">Working across party lines</h2>
      <p>
        Cosponsoring a bill is a public statement of support, and members often cosponsor bills from
        the other party. Two figures are shown, per Congress:
      </p>
      <ul className="plain">
        <li><strong>Cross-party cosponsorship:</strong> of the bills a member cosponsored, the share introduced by a member of the other party.</li>
        <li><strong>Cross-party support:</strong> of the bills a member introduced, the share that drew at least one cosponsor from the other party.</li>
      </ul>
      <p>
        Party is taken as of the date the bill was introduced (for the sponsor) or cosponsored (for the
        cosponsor); independents count with the party they caucus with. Withdrawn cosponsorships don't
        count. Rates aren't shown below 20 cosponsored or 10 introduced bills. Cosponsorship reflects
        support for introducing a bill, not how a member later votes on it.
      </p>

      <h2 id="vote-types">Vote types</h2>
      <p>
        Many roll calls are about procedure rather than a bill itself, and a "no" on a procedural
        vote is not a "no" on the bill. Each vote is labeled from the clerk's own wording:
      </p>
      <ul className="plain">
        <li><strong>Final passage:</strong> whether to pass a bill or resolution, or accept the other chamber's version. "Two-thirds" marks House votes under expedited rules, which need two-thirds to pass.</li>
        <li><strong>Veto override:</strong> whether to pass a bill over the President's veto. Needs two-thirds.</li>
        <li><strong>Confirmation:</strong> whether the Senate confirms a nominee.</li>
        <li><strong>Cloture:</strong> whether the Senate ends debate. Needs 60 votes for most bills and a simple majority for nominations.</li>
        <li><strong>Amendment:</strong> whether to change a bill's text.</li>
        <li><strong>Procedural:</strong> how the chamber proceeds, such as taking up a bill, setting it aside (tabling), sending it back to committee, waiving a budget rule, or adopting a House "rule" that sets the terms of debate for another bill.</li>
      </ul>
      <p>"Final votes only" on a member page shows final passage, veto overrides and confirmations.</p>
      <p>
        Next to each recorded position, a short phrase says what that position meant on that kind of vote,
        such as "Nay · against ending debate" or "Yea · to send it back to committee". It describes the
        procedure only, from the vote type, never what the vote would have done or why a member voted that way.
      </p>

      <h2 id="vote-sentences">What a vote decided, in one sentence</h2>
      <p>
        Each roll call starts with one sentence, such as "A Yes vote was to pass H.R. 1. It passed, 218–214,
        so it goes to the Senate." It is filled into a fixed template for that kind of vote, using only the
        clerk's official question, the official result and the measure's number; it is not written by AI and
        doesn't describe the bill's content or effects. Every vote of the same kind gets the same wording,
        whoever voted on it.
      </p>
      <p>
        A vote threshold is mentioned only where it is fixed by the rules (two-thirds to suspend the rules or
        override a veto, 60 votes for cloture on legislation, a simple majority for cloture on nominations) or
        stated in the Senate's own result. "What happens next" is mentioned only where the measure's type
        settles it, such as a House bill going to the Senate after the House passes it. If a question isn't
        one of the recognized kinds, the sentence just gives the official question and result. The clerk's own
        wording always appears beneath it, linked to the roll call.
      </p>

      <h2 id="vote-issues">Votes by issue</h2>
      <p>
        Each bill gets one policy area from the Library of Congress (for example "Health" or "Immigration"),
        chosen by its legislative analysts. A vote takes the policy area of the bill it was on, including
        votes on amendments, procedural motions and rules for that bill, so the vote-type label matters when
        reading them. A broad bill, such as a budget or a large package, still gets one policy area, so its
        votes appear under that one issue only. A House "rule" that sets the terms of debate for a bill
        is a separate resolution with its own policy area, usually "Congress".
      </p>
      <p>
        Votes on nominations are grouped as "Nominations". Votes with no bill or nominee, such as electing
        the Speaker or motions about chamber procedure, are grouped as "Other votes".
      </p>

      <h2 id="issues">Issues you care about</h2>
      <p>
        The issues page uses everyday names, such as "Jobs and pay", for the Library of Congress policy areas
        described above. Each name stands for one or two official policy areas (for example, "Environment and
        energy" covers "Environmental Protection" and "Energy"), and the page shows which ones under each issue.
        Policy areas without an everyday name are listed under "More topics" with their official names. The
        names describe a subject only; they don't say what a bill on it would do.
      </p>
      <p>
        The one-line counts come from the official records, for the last 30 days. A bill counts as having moved
        if a step on its track happened in those days: reported by a committee, a vote in the House or Senate
        (passed or failed), sent to the President, signed into law or vetoed. Being introduced isn't counted.
        Roll-call votes are recorded votes on bills in those policy areas, as described above. Bills the Library
        of Congress hasn't yet assigned a policy area aren't in any issue. If you looked up your address on this
        device, each vote also shows how your members of Congress voted, as the clerk recorded it. Your picks are
        saved on your device only.
      </p>

      <h2 id="text-versions">What changed between bill versions</h2>
      <p>
        Each time a bill moves a step, the Government Publishing Office prints a new official version. For each
        version, we compare its full text with the version before it, section by section. A section is matched by its
        heading inside its title; when a title is renamed, sections with a heading found once in each version are still
        matched. A section counts as changed when any of its words differ (spacing and quote styles are ignored), so a
        one-word fix and a full rewrite both count as one changed section. Section numbers are left out, because
        renumbering changes nothing. A renamed section counts as one removed and one added. Text quoted into existing
        law belongs to the section that quotes it. Text a committee struck is left out, as it is no longer part of the bill.
      </p>
      <p>
        An "engrossed amendment" lists only the changes the second chamber made, so it is shown but not compared; the
        enrolled version, which has the final text, is compared with the version before the amendment. The comparison
        is computed, not written by anyone, and it says where the text changed, not what a change does.
      </p>

      <h2 id="record">A member's record by date</h2>
      <p>
        "Record by date" on each member page lists, newest first: roll-call votes with the member's
        recorded position and the clerk's wording of the question and result; bills the member introduced;
        the member's bills that became law; and stock trades the member reported, with the date the report
        was filed. "Main events" shows final-passage and confirmation votes; "Every roll call" adds
        amendments and procedural votes. Every member's record uses the same entries in the same words,
        and each links to its source.
      </p>

      <h2 id="bill-parts">Every part of a bill</h2>
      <p>
        A bill's page lists every title and section of its newest official text from GovInfo, in order, with
        each section's own heading and its length in words, and opens any section's text in place. The search
        shows which sections mention a word. Headings and text are the bill's own, in English. A public law's
        text is read from the enrolled bill, which has the same words.
      </p>

      <h2 id="section-summaries">AI summaries of bill sections</h2>
      <p>
        Some sections carry a short plain-language summary, labeled "AI-generated summary," with the section's
        official text one tap away. The text is the record; the summary is a reading aid. The Congressional
        Research Service's summary, where one exists, stays at the top of the bill's page.
      </p>
      <p>
        Summaries are written ahead of time by Anthropic's Claude Haiku model from the section's text alone, with
        the same written instructions for every bill: say what the section does, who must or may do what,
        amounts and dates as printed; add no background; never describe purpose, effect, or who gains or loses
        unless the text says so; use no words that judge. Each summary is then checked by a second request that
        compares it with the text and lists any statement the text doesn't support. A flagged summary is
        rewritten once with those problems named and checked again; if it still fails, it is not shown. Sections
        under 40 words and tables of contents are not summarized. A summary belongs to one version of the text,
        so a new version gets new summaries. Spanish summaries are written with the English ones and checked
        against them.
      </p>

      <h2 id="bill-stage">Where a bill stands</h2>
      <p>
        The track at the top of a bill page is built from the bill's official action list in GovInfo Bill Status. Each
        step is the first date the Library of Congress action code for it appears: introduced; reported by a committee
        (5000 or 14000); passed or agreed to in the House (8000) or failed there (9000); the same in the Senate (17000,
        18000); presented to the President (28000); vetoed (31000); became law (36000, only when the action says it became
        a public or private law, not just that it was signed). The committee step also shows the date the bill was
        referred, from the bill's committee list.
      </p>
      <p>
        The steps depend on the kind of measure. A simple resolution (H.Res., S.Res.) needs only its own chamber. A
        concurrent resolution needs both chambers and does not go to the President. A joint resolution whose official
        title proposes an amendment to the Constitution goes to the states after both chambers pass it; state
        ratification is not in the records we use, so that step has no date. Bills and other joint resolutions go to the
        President.
      </p>
      <p>
        Nothing is filled in by guesswork. When a later step is in the record but an earlier one's date is not, the
        earlier step says "Date not in the record". When a bill moved on with no committee report in the record (a
        committee can be discharged or bypassed), the committee step says so. A roll call is linked to a step only when
        exactly one passage vote in that chamber falls on that day; many bills pass by voice vote, with no roll call. The
        "Next" sentence names the chamber that would act next, and says a vote is scheduled only when the House floor
        schedule or a committee markup lists the bill. For a bill from a past Congress that did not become law, the page
        says the Congress ended without it becoming law: bills that are not enacted by the end of a Congress would have to
        be introduced again. The fold "Steps and actions" shows every recorded date with its action code, and links to the
        full list of actions at Congress.gov.
      </p>

      <h2 id="photos">Photos</h2>
      <p>
        Members of Congress are shown with their official portraits, from the public-domain collection kept by the
        unitedstates project. State officials are shown with the official photo Open States links to, loaded from the
        legislature's or office's own website. Where a source has no photo, none is shown. County and city officials
        are shown without photos everywhere, because no source collects them for every place.
      </p>

      <h2 id="on-the-ballot">On the ballot</h2>
      <p>
        The On the ballot page lists the seats on each general-election ballot and who holds them now. It is worked out
        from term end dates, not from who is running: a seat is on a year's ballot when its holder's term ends after January 3
        of the year before and by January 3 after that year's election. That also catches a senator appointed until
        a special election. House seats for the next election appear once the members elected before it take office.
        California's cycles (statewide offices in gubernatorial years, the state Senate's odd- and even-numbered districts
        in alternate elections) follow the state constitution; Orange County's come from each official's term dates.
        After an election, once the new terms begin and appear in the official member list, each seat shows
        whether the person who held it returned and, for the Senate, who holds it now. The House shows only whether
        the member returned, because districts can be redrawn between Congresses. The site doesn't say anyone lost:
        a holder may not have run. Missing portraits show a plain grey silhouette.
        Candidates who have filed are on the 2028 candidates page.
      </p>

      <h2 id="first-time-voter">First time voting?</h2>
      <p>
        The First time voting page gives three steps: register, know your ballot, know who represents you. It states only
        what doesn't vary from state to state: the 26th Amendment sets the voting age at 18 for U.S. citizens. Deadlines,
        ID rules and pre-registration ages differ by state and change, so the page doesn't list them; it links to vote.gov,
        the U.S. government's registration site, which leads to every state's election office. For California visitors
        (from a lookup saved on this device) it also links to the Secretary of State's online registration, registration
        status and pre-registration pages. Those links were checked to respond in November 2026. Other states' own links
        will be added only from official sources.
      </p>

      <h2 id="ca-results">California election results</h2>
      <p>
        Results for California's November 3, 2026 general election come from the California Secretary of State. While
        counties count ballots, they are the semi-official results the Secretary of State publishes on
        electionresults.sos.ca.gov, read twice a day from the same public data feed that site uses. Those numbers
        change as counting continues, so each result shows when the Secretary of State last updated it. Counties finish
        their official canvass by December 3, and the Secretary of State certifies the results on December 11, 2026 in
        the Statement of Vote. Once the Statement of Vote's spreadsheets are posted and cover every race, the site adds
        up their county totals, shows those in place of the semi-official numbers, and marks the results certified.
      </p>
      <p>
        Covered: the eight statewide offices, the four Board of Equalization districts, the statewide ballot measures and
        all 52 U.S. House districts (no U.S. Senate seat from California was on the 2026 ballot). Candidate names, party
        and measure titles are shown as the Secretary of State prints them. Civic Atlas doesn't call races or mark
        anyone as the winner; it shows each candidate's votes and percent. California used new congressional maps in
        2026, so a member's page shows a 2026 race only when the name printed on the ballot matches the member's name
        (ignoring capital letters and punctuation), never by district number alone.
      </p>

      <h2 id="election-results">Election results</h2>
      <p>
        Member pages list each general election in which the member was a candidate, and the On the ballot page shows a
        seat holder's share of the vote, from official certified results. The main source is the FEC's Federal Elections
        publication, which compiles each state's certified results for the Senate and House, including special elections,
        runoffs and ranked-choice rounds. The FEC publishes it long after the election (Federal Elections 2022 appeared in
        2025). For a year the FEC hasn't published yet, results come from the House Clerk's Statistics of the Presidential
        and Congressional Election, published a few months after the election; 2024 currently comes from the Clerk. A
        monthly job checks for new publications and switches a year to the FEC's file once it appears.
      </p>
      <p>
        Names and parties are shown exactly as printed: the FEC prints "Last, First" and party codes (D, R, LIB, W for
        write-in), the Clerk prints full names and party names. In New York, Connecticut and other states where a candidate
        can run on more than one party line, each line is listed and the total is the candidate's combined vote. In the
        FEC's file, percent is as printed: the share of all votes cast in the race. The Clerk prints votes only, so for
        those years the percent is calculated here, as the candidate's votes over all votes printed for the race, leaving
        out blank, void, over- and under-votes. Some states don't print unopposed candidates on the ballot, so there is no
        vote count for them. The site doesn't mark winners or margins: the On the ballot page says who held each seat
        afterward from the official member list.
      </p>
      <p>
        Members are matched to candidates by FEC candidate ID, the same IDs the member data carries. The FEC's file
        prints an ID for each candidate. For Clerk years, IDs come from the FEC's list of congressional candidates on
        general-election ballots, matched within the same race by last name (and first name, or a one- or two-letter
        spelling difference). When a source prints one ID for two candidates in the same race, the ID stays only with the
        candidate who is the member of Congress holding it, and otherwise is dropped, so that race may not appear on
        that member's page.
      </p>

      <h2 id="leadership">Leadership and Speaker elections</h2>
      <p>
        Leadership posts (Speaker, floor leaders, whips, President pro tempore, and party conference and caucus
        officers) come from the public-domain congress-legislators dataset, with titles shown as published there and
        the date each post began. A post counts as current from its start date until its end date; when the dataset
        lists no end date yet, it stays current until the dataset is updated. Member pages and lookup cards show
        current posts only, in the same words for everyone.
      </p>
      <p>
        Speaker elections are House roll calls the Clerk records as "Election of the Speaker", from 2023 on. Members
        answer with a name, so each position is a name as the Clerk recorded it, or "Present" or "Not Voting". We count
        the positions on each ballot and show the Clerk's recorded result unchanged; on these ballots the Clerk's
        result is the name with the most votes, whether or not it is a majority. A Speaker is elected by a majority of
        the votes cast for a person by name, so we also show that number, worked out from the counts. Ballots are
        numbered within each election, which ends with the ballot on which a candidate received a majority. Committee
        chairs and ranking members are the full committees' rosters for the latest Congress on record.
      </p>

      <h2 id="hearings">Committee hearings and meetings</h2>
      <p>
        Hearings, markups and business meetings in both chambers come from Congress.gov's committee meeting records,
        from 2023 on, updated daily: date, committee, location, video, documents, and the bills and nominations on the
        agenda. Witness lists and written testimony appear for House hearings only. House committees file them in the
        central record; Senate committees post them on their own websites, so Senate hearing pages link there instead.
        A meeting's bills are the ones the record lists, which may not include every bill discussed.
      </p>

      <h2 id="map">The map</h2>
      <p>
        District lines come from the Census Bureau: its cartographic boundary file for the current Congress, and its
        2026 TIGER/Line files for the next one, trimmed to the coastline. Lines are simplified so the map loads quickly,
        so near a boundary the map can be off by a block or so; the address lookup uses exact lines. Districts are all
        drawn in one color; party appears only beside names. The street map is from OpenFreeMap, built on
        OpenStreetMap data; it needs no account, and we don't send it anything about you, though like any website it
        sees requests for the map tiles your browser shows.
      </p>
      <p>
        District figures (population, median age, household income, home value, education and poverty) are the Census
        Bureau's American Community Survey 5-year estimates for each district. They are survey estimates, so each has a
        margin of error, and they describe the years surveyed rather than today. Counties show how many district
        residents live in each. Cities and towns are listed when their center point falls inside the district; a
        district that lies inside one big city (most of Manhattan, for example) instead shows the city that covers most
        of its land, marked as part. The Census Bureau hasn't published figures for the new lines in states that
        redrew, so those districts show none yet.
      </p>

      <h2 id="accuracy">Checking our accuracy</h2>
      <p>
        Every week, a program picks random facts from this site (how members voted, who sponsored and cosponsored
        bills, law numbers, campaign receipts) and compares each with the original record at the House Clerk,
        the Senate, GovInfo and the FEC. Any difference is investigated, and errors we find are listed on the
        corrections page.
      </p>
      <AccuracyStatus />

      <h2 id="compare">Comparing two members</h2>
      <p>
        The comparison counts roll calls where both members voted Yea or Nay (Guilty or Not Guilty in impeachment
        trials) and reports how often their votes matched. Every kind of roll call counts, including procedural
        votes and amendments, so the figure describes all recorded votes rather than final passage alone. Roll calls
        where either member was absent or voted Present are left out. Only members of the same chamber can be
        compared, since each chamber votes separately.
      </p>

      <h2 id="money">Campaign finance</h2>
      <p>
        Totals come from each campaign's reports to the Federal Election Commission, by two-year cycle.
        For the most recent cycle, a member page also shows:
      </p>
      <ul className="plain">
        <li><strong>Contributions by size:</strong> money from individuals, grouped by the size of each gift. Gifts under $200 don't have to be itemized, so they're shown as one total.</li>
        <li><strong>Where itemized donors live:</strong> itemized contributions from individuals, split by the state in the donor's address (FEC's by-state totals). Only donors giving more than $200 in the cycle are itemized, so small-dollar money isn't included, and an address is where the donor lives, not where they work. Military and overseas addresses count as outside the member's state.</li>
        <li><strong>Donors' employers:</strong> the employers individual donors wrote on their forms, ranked by total. Companies can't contribute directly to federal campaigns; these are gifts from people. Entries that don't name an employer (Retired, Self-employed, Not employed, Homemaker, Student, Information requested, N/A and blanks) are left out of the ranking.</li>
        <li><strong>PACs and other committees:</strong> contributions reported as coming from other political committees, ranked by total among the campaign's 100 largest such contributions. Transfers between a candidate's own committees are not included. Federal limits keep each committee's giving to a few thousand dollars per election.</li>
        <li><strong>Outside spending:</strong> money spent by groups such as super PACs to support or oppose the candidate without coordinating with the campaign, as reported to the FEC.</li>
      </ul>
      <p>No individual donor is named here, and FEC rules bar using donor names for soliciting contributions or commercial purposes.</p>

      <h2 id="budget">Federal budget</h2>
      <p>
        The budget page uses the Treasury's Monthly Treasury Statement, Table 9 ("Summary of Receipts by
        Source, and Outlays by Function"). Each fiscal year's figures are the September statement's
        year-to-date totals; the current year shows the latest month. Outlays are money actually paid
        out, which differs from what Congress appropriates in a given year. Categories and their names
        are Treasury's; some, such as undistributed offsetting receipts, are recorded as negative amounts
        and reduce the total. "Of every $100" divides each category by total outlays (or receipts).
        The year-by-year chart groups spending into the six functions that were largest in most years
        since 2015 (Social Security, Medicare, Health, Net Interest, Income Security, National Defense)
        and everything else, which is total outlays minus those six. Its line marks total receipts.
      </p>
      <p>
        Debt figures come from Debt to the Penny: total public debt outstanding, split into debt held by
        the public and intragovernmental holdings, on the last business day of each fiscal year and the
        latest day published. Both datasets come from the Bureau of the Fiscal Service's Fiscal Data API
        and are rebuilt monthly, after the statement is released.
      </p>
      <p>
        The surplus or deficit since 1940 comes from the Office of Management and Budget's Historical
        Tables, Table 1.3: receipts, outlays and the surplus or deficit in dollars of each year, in
        inflation-adjusted dollars, and as a share of gross domestic product, all as OMB publishes them.
        Only actual years are used; the table's estimates for later years are left out. OMB updates the
        tables with each President's Budget, so its latest actual year can trail the Treasury figures above.
      </p>
      <p>
        Under that chart, three rows show who was president and which party held the majority in the
        Senate and the House, on the same fiscal-year scale. Presidents' dates come from the White House;
        majorities from the Senate's and the House Historian's party division tables, as each chamber
        organized, with independents counted with the party they caucused with. Every party is drawn the
        same way. The rows are context for the dates, not a finding about who caused a deficit.
      </p>
      <h2 id="lobbying">Lobbying on bills</h2>
      <p>
        Under the Lobbying Disclosure Act, lobbying firms and organizations that lobby for themselves file a
        report each quarter for each client. The report lists the issues they lobbied on, often naming bills
        by number. Bill pages list the clients whose reports name that bill, the firms that did the lobbying,
        and the quarters it was reported.
      </p>
      <p>
        Bill numbers are read from the report's text (for example "H.R. 4791" or "S.1462"). A number is matched
        to the Congress in session in the report's year, and only bills this site tracks are kept. A report
        that names a bill by title alone, without its number, isn't counted. When a report is amended, only the
        latest version is used.
        Because only the number is read, a report that cites a bill by its number from an earlier Congress
        (for example, a bill reintroduced under a new number) is matched to whatever bill has that number now.
        Each listing links to the report, so the wording can be checked.
      </p>
      <p>
        A report lists the bill; it doesn't say whether the client supported or opposed it, or what was
        asked for. Reports state income or expenses for the whole report, covering every issue on it, so this
        site doesn't attribute dollar amounts to individual bills. Each listing links to the report itself.
      </p>
      <p>
        Each report also lists the lobbyists who worked on each issue and any "covered" executive or
        legislative branch position each one held in the past 20 years. Bill pages list those lobbyists and
        their positions exactly as filed, for the issues that name the bill. Wording varies from filer to
        filer, and some entries don't describe a government job; we don't edit them or match names to
        members of Congress.
      </p>
      <p>
        Source: LDA.gov, run by the Secretary of the Senate and the Clerk of the House. The Senate Office of
        Public Records can't vouch for data or analyses derived from these reports after they're retrieved.
      </p>

      <h2 id="trades">Stock trades</h2>
      <p>
        Under the STOCK Act, members of Congress must report each purchase, sale or exchange of stocks,
        bonds and similar assets over $1,000 by themselves, their spouse or dependent children, within
        30 days of learning of it and no later than 45 days after the transaction. These reports are
        called Periodic Transaction Reports.
      </p>
      <p>
        Trades are shown as filed: the asset's name, the amount as the range the law requires (exact
        figures are not disclosed), and who owned it. "Days to report" counts from the transaction date to
        the date the report was filed; more than 45 is noted, since that is the law's outer limit. The
        records don't show whether a late fee was paid or waived. When a report lists a trade date after
        its own filing date, the dates are shown as filed and not counted either way.
      </p>
      <p>
        Amended reports often repeat trades from an earlier report. Each trade is shown once, from the
        first report that listed it. Trades that first appear in an amended report are never counted
        as reported after 45 days, since an amendment's date can reflect a correction rather than when
        the trade was first disclosed. Reports filed on paper are linked but not
        itemized. Coverage starts January 2025.
      </p>
      <p>
        By law (5 U.S.C. § 13107), these reports may not be used for any commercial purpose other than by
        news media for dissemination to the public, for determining anyone's credit rating, or for
        soliciting money.
      </p>

      <h2 id="local-agendas">Orange County agendas and "Your week"</h2>
      <p>
        The Board of Supervisors' agenda is read twice a day from the Clerk of the Board's agenda system.
        Each item is shown as printed, in English: its number, department, description, the districts it
        names, any change the Clerk noted (continued, deleted, revised title) and a link to its staff report
        and documents. Nothing is summarized. "Naming your district" counts items that list your supervisor
        district by number; items for all districts are counted separately.
      </p>
      <p>
        What the Board did comes from the Clerk's summary action minutes of recent regular and special meetings:
        each item, each motion as printed, and the vote lines (Ayes, Noes, Abstained, Absent, Excused) exactly as
        recorded. The supervisors' vote counts add up those lines; a supervisor is counted only where the minutes
        name them, so a motion that lists only part of the Board counts only those named. Each supervisor's card
        shows that supervisor's counts, the items behind every vote other than Aye, and how many motions list
        only part of the Board without naming them. Some actions, often closed-session reports, describe a vote
        in a sentence ("on a vote of 3 to 2, with ... voting yes") instead of vote lines. Those are shown as
        printed and listed on every supervisor's card, but not counted, because counting them would mean
        reading names out of a sentence.
      </p>
      <p>
        "Your week" lists what's coming up for the officials at the address you looked up, using the same
        kinds of items and the same wording for everyone: hearings of the committees your members of Congress
        sit on, the House floor schedule, state and county dates, and city council meetings. It is built from
        district numbers saved on your device or carried in the page's link, never from an address. The
        calendar file is made in your browser.
      </p>

      <h2>Where the data comes from</h2>
      <ul className="plain">
        <li><strong>Members, terms, committees:</strong> the public-domain congress-legislators dataset.</li>
        <li><strong>Roll-call votes:</strong> the Clerk of the House and Senate.gov, recorded exactly as published.</li>
        <li><strong>Bills, cosponsors, summaries:</strong> GovInfo Bill Status records from the Library of Congress. Summaries are written by the nonpartisan Congressional Research Service.</li>
        <li><strong>Stock trades:</strong> Periodic Transaction Reports from the Clerk of the House and the Senate's electronic financial disclosure system.</li>
        <li><strong>Campaign finance:</strong> the Federal Election Commission, totals by two-year cycle.</li>
        <li><strong>Election results:</strong> the FEC's Federal Elections publications of certified results, or the House Clerk's election statistics until the FEC publishes a year (<a href="#election-results">details</a>).</li>
        <li><strong>Your district:</strong> Geocodio, using Census Bureau district boundaries. Your address is used only for the lookup and is never stored by us. When address suggestions are on, what you type in the address box is sent to Google Places to suggest matching addresses.</li>
        <li><strong>Visits:</strong> Cloudflare Web Analytics counts page views and visits without cookies and without collecting personal data, so it can't tell who you are or whether you've visited before.</li>
      </ul>
      <p>
        Data is refreshed automatically every day (campaign finance weekly), and each section of a member
        page shows when it was last updated. Coverage starts with the 118th Congress (January 2023).
      </p>

      <h2>Corrections</h2>
      <p>
        If something here is wrong, it will be corrected and the correction noted in the
        public <Link to="/corrections">corrections log</Link>.
      </p>
    </main>
  );
}
