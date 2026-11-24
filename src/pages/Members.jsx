import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { STATE_NAMES, partyTag, date } from "../lib/format.js";

// Every member since 2023, by state. Defaults to those serving now.
export default function Members() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const state = params.get("state") ?? "";
  const chamber = params.get("chamber") ?? "";
  const former = params.get("former") === "1";
  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); };

  useEffect(() => {
    db.from("member_directory").select("bioguide_id,name,last_name,chamber,state,district,party,serving,end_date")
      .order("state").order("chamber", { ascending: false }).order("district").order("last_name").limit(1000)
      .then(({ data, error: e }) => (e ? setError(true) : setRows(data)));
  }, []);

  const groups = useMemo(() => {
    const out = new Map();
    for (const m of rows ?? []) {
      if ((!former && !m.serving) || (state && m.state !== state) || (chamber && m.chamber !== chamber)) continue;
      if (!out.has(m.state)) out.set(m.state, []);
      out.get(m.state).push(m);
    }
    return [...out].sort((a, z) => (STATE_NAMES[a[0]] ?? a[0]).localeCompare(STATE_NAMES[z[0]] ?? z[0]));
  }, [rows, state, chamber, former]);
  const count = groups.reduce((n, [, list]) => n + list.length, 0);
  const states = useMemo(() => [...new Set((rows ?? []).map((m) => m.state))]
    .sort((a, z) => (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[z] ?? z)), [rows]);

  return (
    <main className="page wide">
      <h1>Members of Congress</h1>
      <div className="filters">
        <label>State{" "}
          <select value={state} onChange={(e) => set("state", e.target.value)}>
            <option value="">All</option>
            {states.map((s) => <option key={s} value={s}>{STATE_NAMES[s] ?? s}</option>)}
          </select>
        </label>
        <label>Chamber{" "}
          <select value={chamber} onChange={(e) => set("chamber", e.target.value)}>
            <option value="">Both</option>
            <option value="senate">Senate</option>
            <option value="house">House</option>
          </select>
        </label>
        <label><input type="checkbox" checked={former} onChange={(e) => set("former", e.target.checked ? "1" : "")} /> Include former members (since 2023)</label>
      </div>
      {error && <p className="notice">Couldn't load members right now.</p>}
      {!rows && !error && <p>Loading…</p>}
      {rows && <p className="fine">{count} member{count === 1 ? "" : "s"}. Source: unitedstates/congress-legislators.</p>}
      {groups.map(([st, list]) => (
        <section key={st} className="section">
          <h2>{STATE_NAMES[st] ?? st}</h2>
          <ul className="plain columns">
            {list.map((m) => (
              <li key={m.bioguide_id}>
                <Link to={`/member/${m.bioguide_id}`}>{m.name}</Link> <span className="fine">({partyTag(m)}){m.chamber === "senate" ? " · Senate" : ""}{m.serving ? "" : ` · served until ${date(m.end_date)}`}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
