import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { STATE_NAMES, money, date } from "../lib/format.js";

// "PADILLA, ALEX" -> "Alex Padilla"; the name as filed is kept in the FEC link's title.
export function displayName(filed) {
  const [last, rest] = String(filed).split(/,\s*/);
  const tc = (s) => (s ?? "").toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, p, c) => p + c.toUpperCase());
  return rest ? `${tc(rest)} ${tc(last)}` : tc(last);
}

export function CandidateRow({ c }) {
  return (
    <tr>
      <td>
        {c.bioguide_id ? <Link to={`/member/${c.bioguide_id}`}>{displayName(c.name)}</Link> : displayName(c.name)}
        {c.incumbent_challenge === "Incumbent" && <span className="fine"> · incumbent</span>}
      </td>
      <td>{c.party ?? "—"}</td>
      <td>{c.receipts != null ? money(Number(c.receipts)) : <span className="fine">No reports yet</span>}
        {c.coverage_end_date && <div className="fine">through {date(c.coverage_end_date)}</div>}</td>
      <td><a href={`https://www.fec.gov/data/candidate/${c.fec_candidate_id}/`} title={c.name}>FEC</a></td>
    </tr>
  );
}

export function CandidateTable({ list }) {
  return (
    <table>
      <thead><tr><th>Candidate</th><th>Party (as filed)</th><th>Raised, two-year period</th><th>Filings</th></tr></thead>
      <tbody>{list.map((c) => <CandidateRow key={c.fec_candidate_id} c={c} />)}</tbody>
    </table>
  );
}

// Who has filed with the FEC to run for Congress in the next election, by state.
export default function Elections() {
  const [params, setParams] = useSearchParams();
  const state = (params.get("state") ?? "").toUpperCase();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    db.from("candidates").select("*").order("election_year", { ascending: false }).order("name").limit(5000)
      .then(({ data }) => setRows(data ?? []));
  }, []);

  const year = rows?.[0]?.election_year;
  const inYear = useMemo(() => (rows ?? []).filter((r) => r.election_year === year), [rows, year]);
  const states = useMemo(() => [...new Set(inYear.map((r) => r.state))].sort((a, z) => (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[z] ?? z)), [inYear]);
  const here = inYear.filter((r) => r.state === state);
  const senate = here.filter((r) => r.office === "S");
  const districts = [...new Set(here.filter((r) => r.office === "H").map((r) => r.district))].sort((a, z) => a - z);

  return (
    <main className="page wide">
      <h1>{year ? `${year} elections` : "Upcoming elections"}: who has filed</h1>
      <p className="lede">Candidates for Congress who have registered with the Federal Election Commission.</p>
      <p className="fine">
        Anyone can file, and filing doesn't mean a campaign is active; money raised shows which campaigns are reporting
        activity. Listed alphabetically. House districts are as filed; {year} House races use the district maps adopted for 2026.
      </p>
      {!rows ? <p>Loading…</p> : inYear.length === 0 ? <p>No candidates have filed yet.</p> : (
        <>
          <div className="filters">
            <label>State{" "}
              <select value={state} onChange={(e) => setParams(e.target.value ? { state: e.target.value } : {})}>
                <option value="">Choose a state</option>
                {states.map((s) => <option key={s} value={s}>{STATE_NAMES[s] ?? s} ({inYear.filter((r) => r.state === s).length})</option>)}
              </select>
            </label>
          </div>
          {!state && <p>{inYear.length} candidates have filed so far in {states.length} states. Choose a state to see them.</p>}
          {state && (
            <>
              {senate.length > 0 && (
                <section className="section">
                  <h2>Senate</h2>
                  <CandidateTable list={senate} />
                </section>
              )}
              {districts.map((d) => (
                <section className="section" key={d}>
                  <h2>House, {d === 0 ? "at-large" : `District ${d}`}</h2>
                  <CandidateTable list={here.filter((r) => r.office === "H" && r.district === d)} />
                </section>
              ))}
              {here.length === 0 && <p>No candidates have filed in {STATE_NAMES[state] ?? state} yet.</p>}
            </>
          )}
        </>
      )}
      <p className="fine">Source: Federal Election Commission (OpenFEC), updated weekly.</p>
    </main>
  );
}
