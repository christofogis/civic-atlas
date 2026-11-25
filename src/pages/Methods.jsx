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

      <h2>Where the data comes from</h2>
      <ul className="plain">
        <li><strong>Members, terms, committees:</strong> the public-domain congress-legislators dataset.</li>
        <li><strong>Roll-call votes:</strong> the Clerk of the House and Senate.gov, recorded exactly as published.</li>
        <li><strong>Bills, cosponsors, summaries:</strong> GovInfo Bill Status records from the Library of Congress. Summaries are written by the nonpartisan Congressional Research Service.</li>
        <li><strong>Stock trades:</strong> Periodic Transaction Reports from the Clerk of the House and the Senate's electronic financial disclosure system.</li>
        <li><strong>Campaign finance:</strong> the Federal Election Commission, totals by two-year cycle.</li>
        <li><strong>Your district:</strong> Geocodio, using Census Bureau district boundaries. Your address is used only for the lookup and is never stored by us. When address suggestions are on, what you type in the address box is sent to Google Places to suggest matching addresses.</li>
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
