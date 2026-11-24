import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import DownloadCsv from "../components/DownloadCsv.jsx";
import { STATE_NAMES, stateName, partyTag, date } from "../lib/format.js";
import { tr } from "../lib/lang.js";

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
      <h1>{tr("Members of Congress", "Miembros del Congreso")}</h1>
      <div className="filters">
        <label>{tr("State", "Estado")}{" "}
          <select value={state} onChange={(e) => set("state", e.target.value)}>
            <option value="">{tr("All", "Todos")}</option>
            {states.map((s) => <option key={s} value={s}>{stateName(s)}</option>)}
          </select>
        </label>
        <label>{tr("Chamber", "Cámara")}{" "}
          <select value={chamber} onChange={(e) => set("chamber", e.target.value)}>
            <option value="">{tr("Both", "Ambas")}</option>
            <option value="senate">{tr("Senate", "Senado")}</option>
            <option value="house">{tr("House", "Cámara de Representantes")}</option>
          </select>
        </label>
        <label><input type="checkbox" checked={former} onChange={(e) => set("former", e.target.checked ? "1" : "")} /> {tr("Include former members (since 2023)", "Incluir exmiembros (desde 2023)")}</label>
      </div>
      {error && <p className="notice">{tr("Couldn't load members right now.", "No se pudieron cargar los miembros en este momento.")}</p>}
      {!rows && !error && <p>{tr("Loading…", "Cargando…")}</p>}
      {rows && <p className="fine">{tr(`${count} member${count === 1 ? "" : "s"}. Source: unitedstates/congress-legislators.`, `${count} miembro${count === 1 ? "" : "s"}. Fuente: unitedstates/congress-legislators.`)}</p>}
      <DownloadCsv rows={groups.flatMap(([, list]) => list)} filename="members" columns={[
        ["Name", (m) => m.name], ["Party", (m) => m.party], ["Chamber", (m) => m.chamber], ["State", (m) => m.state],
        ["District", (m) => (m.chamber === "house" ? m.district : "")], ["Serving", (m) => (m.serving ? "yes" : "no")],
        ["Bioguide ID", (m) => m.bioguide_id], ["Page", (m) => `${window.location.origin}/member/${m.bioguide_id}`],
      ]} />
      {groups.map(([st, list]) => (
        <section key={st} className="section">
          <h2>{stateName(st)}</h2>
          <ul className="plain columns">
            {list.map((m) => (
              <li key={m.bioguide_id}>
                <Link to={`/member/${m.bioguide_id}`}>{m.name}</Link> <span className="fine">({partyTag(m)}){m.chamber === "senate" ? tr(" · Senate", " · Senado") : ""}{m.serving ? "" : tr(` · served until ${date(m.end_date)}`, ` · en el cargo hasta el ${date(m.end_date)}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
