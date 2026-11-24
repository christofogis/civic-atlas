import { Link } from "react-router-dom";

// How every number on the site is produced. Keep this in step with the code:
// supabase/migrations/*_member_vote_stats.sql and scripts/ingest/*.
export default function Methods() {
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

      <h2>Where the data comes from</h2>
      <ul className="plain">
        <li><strong>Members, terms, committees:</strong> the public-domain congress-legislators dataset.</li>
        <li><strong>Roll-call votes:</strong> the Clerk of the House and Senate.gov, recorded exactly as published.</li>
        <li><strong>Bills, cosponsors, summaries:</strong> GovInfo Bill Status records from the Library of Congress. Summaries are written by the nonpartisan Congressional Research Service.</li>
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
