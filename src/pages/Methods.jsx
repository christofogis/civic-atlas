import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

// How every number on the site is produced. Keep this in step with the code:
// supabase/migrations/*_member_vote_stats.sql and scripts/ingest/*.
export default function Methods() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash]);
  return (
    <main className="page prose">
      <p><Link to="/">← Search</Link></p>
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

      <h2 id="money">Campaign finance</h2>
      <p>
        Totals come from each campaign's reports to the Federal Election Commission, by two-year cycle.
        For the most recent cycle, a member page also shows:
      </p>
      <ul className="plain">
        <li><strong>Contributions by size:</strong> money from individuals, grouped by the size of each gift. Gifts under $200 don't have to be itemized, so they're shown as one total.</li>
        <li><strong>Donors' employers:</strong> the employers individual donors wrote on their forms, ranked by total. Companies can't contribute directly to federal campaigns; these are gifts from people. Entries that don't name an employer (Retired, Self-employed, Not employed, Homemaker, Student, Information requested, N/A and blanks) are left out of the ranking.</li>
        <li><strong>PACs and other committees:</strong> contributions reported as coming from other political committees, ranked by total among the campaign's 100 largest such contributions. Transfers between a candidate's own committees are not included. Federal limits keep each committee's giving to a few thousand dollars per election.</li>
        <li><strong>Outside spending:</strong> money spent by groups such as super PACs to support or oppose the candidate without coordinating with the campaign, as reported to the FEC.</li>
      </ul>
      <p>No individual donor is named here, and FEC rules bar using donor names for soliciting contributions or commercial purposes.</p>

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
        <li><strong>Your district:</strong> Geocodio, using Census Bureau district boundaries. Your address is used only for the lookup and is never stored.</li>
      </ul>
      <p>
        Data is refreshed automatically every day (campaign finance weekly), and each section of a member
        page shows when it was last updated. Coverage starts with the 118th Congress (January 2023).
      </p>

      <h2>Corrections</h2>
      <p>
        If something here is wrong, it will be corrected and the correction noted. A public corrections
        log is coming soon.
      </p>
    </main>
  );
}
