import { NotesList, Ref } from "../components/Notes.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import DownloadCsv from "../components/DownloadCsv.jsx";
import { STATE_NAMES, stateName, partyTag, date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { PartyTag } from "../components/PartyTag.jsx";

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
  // Terms that ended in the last 30 days (Jan 3 for a Congress) with no newer term in the data yet:
  // the source adds re-elected and new members' terms a day or more later. Those aren't shown as
  // serving, and aren't described as having left either.
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  // Only regular term ends (Jan 3), not a resignation or an appointment that ran out.
  const justEnded = (m) => !m.serving && m.end_date?.endsWith("-01-03") && m.end_date <= today && m.end_date > monthAgo;
  // Only while the new terms are missing (most House seats without a serving member); afterwards
  // those still not serving left office, and read "served until" as usual.
  const servingHouse = (rows ?? []).filter((m) => m.serving && m.chamber === "house").length;
  const updating = rows && servingHouse < 390;
  const endedCount = updating ? rows.filter(justEnded).length : 0;
  const endedOn = (rows ?? []).filter(justEnded).map((m) => m.end_date).sort().at(-1);
  const states = useMemo(() => [...new Set((rows ?? []).map((m) => m.state))]
    .sort((a, z) => (STATE_NAMES[a] ?? a).localeCompare(STATE_NAMES[z] ?? z)), [rows]);

  return (
    <main className="page wide">
      <h1>{tr("Members of Congress", "Miembros del Congreso")}<Ref id="src" text={tr("Source: unitedstates/congress-legislators, updated daily.", "Fuente: unitedstates/congress-legislators, actualizado a diario.")} /></h1>
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
      {rows && endedCount > 0 && (
        <p className="notice">{tr(`${endedCount} member${endedCount === 1 ? "'s term" : "s' terms"} ended on ${date(endedOn)} and the official member list doesn't have the new terms yet. Members who were re-elected are listed as serving once it adds them; until then everyone whose term ended appears only with former members.`,
          `${endedCount} período${endedCount === 1 ? "" : "s"} de miembros terminó${endedCount === 1 ? "" : "ron"} el ${date(endedOn)} y la lista oficial de miembros aún no tiene los nuevos períodos. Los miembros reelegidos aparecerán en el cargo cuando se agreguen; mientras tanto, todos aquellos cuyo período terminó figuran solo con los exmiembros.`)}</p>
      )}
      {rows && <p className="fine">{tr(`${count} member${count === 1 ? "" : "s"}.`, `${count} miembro${count === 1 ? "" : "s"}.`)}</p>}
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
                <Link to={`/member/${m.bioguide_id}`}>{m.name}</Link> <PartyTag p={m} /> <span className="fine">{m.chamber === "senate" ? tr(" · Senate", " · Senado") : ""}{m.serving ? "" : updating && justEnded(m) ? tr(` · term ended ${date(m.end_date)}; data updating`, ` · el período terminó el ${date(m.end_date)}; datos en actualización`) : tr(` · served until ${date(m.end_date)}`, ` · en el cargo hasta el ${date(m.end_date)}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <NotesList />
    </main>
  );
}
