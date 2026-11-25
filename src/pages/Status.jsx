import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import AccuracyStatus from "../components/AccuracyStatus.jsx";
import { NotesList, NotesProvider, Ref } from "../components/Notes.jsx";

// Site status: when each kind of record was last updated, the latest automated checks, and dates
// coming up when records need updating. Everything here is already public (the ingest log, the
// GitHub job history); nothing about visitors or addresses.
const REPO = "christofogis/civic-atlas";

// Each data job in the ingest log: what it updates, how often it runs, and when it counts as late
// (GitHub can start scheduled jobs hours late, so the margin is generous).
const JOBS = [
  ["members", ["Members of Congress and their terms", "Miembros del Congreso y sus períodos"], "2x", 30],
  ["committees", ["Committees and their members", "Comités y sus miembros"], "2x", 30],
  ["votes-119", ["Roll-call votes, 119th Congress", "Votaciones nominales, 119.º Congreso"], "2x", 30],
  ["bills", ["Bills, sponsors and actions", "Proyectos, patrocinadores y acciones"], "2x", 30],
  ["bill-text", ["Bill text versions", "Versiones del texto de los proyectos"], "2x", 30],
  ["schedule", ["House floor schedule", "Agenda del pleno de la Cámara"], "2x", 30],
  ["meetings", ["Committee hearings and meetings", "Audiencias y reuniones de comités"], "2x", 30],
  ["trades", ["Stock trade reports", "Informes de operaciones bursátiles"], "2x", 30],
  ["lobbying", ["Lobbying reports", "Informes de cabildeo"], "2x", 30],
  ["state-people", ["State legislators and officials", "Legisladores y funcionarios estatales"], "2x", 30],
  ["executive", ["Cabinet and nominations", "Gabinete y nominaciones"], "2x", 30],
  ["fec-summaries", ["Campaign finance totals", "Totales de finanzas de campaña"], "weekly", 8.5 * 24],
  ["fec-candidates", ["Campaign finance candidates", "Candidatos en finanzas de campaña"], "weekly", 8.5 * 24],
  ["fec-detail", ["Campaign finance detail (donor sizes, employers, PACs)", "Detalle de finanzas de campaña (tamaño de donaciones, empleadores, PAC)"], "weekly", 8.5 * 24],
  ["votes-118", ["Roll-call votes, 118th Congress (complete)", "Votaciones nominales, 118.º Congreso (completo)"], "done", null],
];
const OFTEN = { "2x": ["Twice a day", "Dos veces al día"], weekly: ["Weekly", "Cada semana"], done: ["No longer updated", "Ya no se actualiza"] };

// Automated checks and builds, from the public GitHub job history.
const CHECKS = [
  ["Site check", ["Site check: every page loads and reads right", "Verificación del sitio: cada página carga y se lee bien"]],
  ["Accuracy check", ["Accuracy check: facts against their sources", "Verificación de exactitud: datos contra sus fuentes"]],
  ["Build federal budget data", ["Budget figures rebuilt", "Cifras del presupuesto reconstruidas"]],
];

const hoursSince = (t) => (Date.now() - Date.parse(t)) / 36e5;
const ago = (t) => {
  const h = hoursSince(t);
  if (h < 1) return tr(`${Math.max(1, Math.round(h * 60))} min ago`, `hace ${Math.max(1, Math.round(h * 60))} min`);
  if (h < 48) return tr(`${Math.round(h)} hours ago`, `hace ${Math.round(h)} horas`);
  return tr(`${Math.round(h / 24)} days ago`, `hace ${Math.round(h / 24)} días`);
};

function DataJobs() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    // The latest few runs of every job: enough to find each job's last success and latest run.
    db.from("ingest_runs").select("job,started_at,finished_at,status,rows_inserted,rows_updated,rows_deleted")
      .order("started_at", { ascending: false }).limit(300)
      .then(({ data, error }) => setRows(error ? false : data));
  }, []);
  if (rows === null) return <p>{tr("Loading…", "Cargando…")}</p>;
  if (!rows) return <p className="notice">{tr("The update log didn't load. Reload the page to try again.", "El registro de actualizaciones no se cargó. Vuelva a cargar la página.")}</p>;
  return (
    <div className="table-scroll">
      <table className="status-table">
        <thead><tr><th>{tr("Records", "Registros")}</th><th>{tr("Updated", "Se actualiza")}</th><th>{tr("Last successful update", "Última actualización correcta")}</th><th>{tr("Latest run", "Última ejecución")}</th></tr></thead>
        <tbody>
          {JOBS.map(([job, label, often, maxH]) => {
            const runs = rows.filter((r) => r.job === job);
            const ok = runs.find((r) => r.status === "succeeded");
            const latest = runs[0];
            // A run still marked "running" long after it started was stopped before it could finish.
            const stuck = latest?.status === "running" && hoursSince(latest.started_at) > 6;
            const late = maxH && (!ok || hoursSince(ok.finished_at) > maxH);
            const changed = ok ? ok.rows_inserted + ok.rows_updated + ok.rows_deleted : 0;
            const state = !latest ? null : stuck ? "stopped" : latest.status;
            return (
              <tr key={job}>
                <td>{tr(...label)}</td>
                <td className="fine">{tr(...OFTEN[often])}</td>
                <td>
                  {ok ? <>{ago(ok.finished_at)} <span className="fine">· {tr(`${changed.toLocaleString()} records changed`, `${changed.toLocaleString()} registros cambiados`)}</span></> : "—"}
                  {late && <> <span className="status-flag warn">{tr("Late", "Atrasado")}</span></>}
                </td>
                <td>
                  {state === "succeeded" && <span className="status-flag ok">{tr("Worked", "Correcta")}</span>}
                  {state === "running" && <span className="status-flag">{tr("Running now", "En curso")}</span>}
                  {state === "failed" && <span className="status-flag warn">{tr("Failed", "Falló")}</span>}
                  {state === "stopped" && <span className="status-flag warn">{tr("Stopped before finishing", "Se detuvo antes de terminar")}</span>}
                  {latest && <span className="fine"> {ago(latest.started_at)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Checks() {
  const [runs, setRuns] = useState(null);
  useEffect(() => {
    // One request for the latest 100 job runs; GitHub allows 60 an hour per visitor without a key.
    fetch(`https://api.github.com/repos/${REPO}/actions/runs?per_page=100&status=completed`)
      .then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setRuns(d.workflow_runs)).catch(() => setRuns(false));
  }, []);
  if (runs === null) return <p>{tr("Loading…", "Cargando…")}</p>;
  if (!runs) return <p className="fine">{tr("GitHub's job history didn't load. ", "El historial de trabajos de GitHub no se cargó. ")}<a href={`https://github.com/${REPO}/actions`}>{tr("See it on GitHub", "Verlo en GitHub")}</a>.</p>;
  return (
    <ul className="plain status-checks">
      {CHECKS.map(([name, label]) => {
        const r = runs.find((x) => x.name === name);
        return (
          <li key={name}>
            {r ? (r.conclusion === "success"
              ? <span className="status-flag ok">{tr("Passed", "Aprobada")}</span>
              : <span className="status-flag warn">{r.conclusion === "failure" ? tr("Failed", "Falló") : r.conclusion}</span>) : <span className="status-flag">—</span>}
            {" "}{tr(...label)}{r && <> · <a href={r.html_url}>{ago(r.updated_at)}</a></>}
          </li>
        );
      })}
    </ul>
  );
}

// Dates when records change and need updating, from the site's own data files.
function ComingUp() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    Promise.all([
      fetch("/data/state/ca-statewide.json").then((r) => r.json()).catch(() => null),
      fetch("/data/local/ca-orange.json").then((r) => r.json()).catch(() => null),
    ]).then(([st, oc]) => {
      const list = [["2027-01-03", tr("The 120th Congress begins: new House and Senate terms, and new district lines in nine states", "Comienza el 120.º Congreso: nuevos períodos en la Cámara y el Senado, y nuevos distritos en nueve estados")]];
      if (st?.seat_change_by) list.push([st.seat_change_by, tr("New terms for California's statewide offices and Board of Equalization; certified results due from the Secretary of State", "Nuevos períodos para los cargos estatales de California y la Junta de Igualación; resultados certificados del Secretario de Estado")]);
      const sup = (oc?.supervisors ?? []).filter((s) => s.term_end && s.term_end >= new Date().toISOString().slice(0, 10));
      const soon = [...new Set(sup.map((s) => s.term_end))].sort()[0];
      if (soon) list.push([soon, tr(`New terms for Orange County supervisors, Districts ${sup.filter((s) => s.term_end === soon).map((s) => s.district).join(", ")}`, `Nuevos períodos para supervisores del Condado de Orange, distritos ${sup.filter((s) => s.term_end === soon).map((s) => s.district).join(", ")}`)]);
      for (const c of oc?.cities ?? []) {
        const seats = (c.members ?? []).filter((m) => m.seat_change_by);
        if (seats.length) list.push([seats[0].seat_change_by, tr(`${c.name} City Council seats ${seats.map((m) => m.district).join(" and ")} and its new mayor`, `Escaños ${seats.map((m) => m.district).join(" y ")} del Concejo Municipal de ${c.name} y su nueva alcaldía`)]);
      }
      const last = (oc?.board_meetings?.dates ?? []).map((d) => d.date ?? d).sort().at(-1);
      if (last) list.push([last, tr("Last Orange County board meeting on file; next year's schedule needed", "Última reunión de la junta del Condado de Orange registrada; se necesita el calendario del próximo año")]);
      const today = new Date().toISOString().slice(0, 10);
      setItems(list.filter(([d]) => d >= today).sort((a, b) => a[0].localeCompare(b[0])));
    });
  }, []);
  if (!items) return <p>{tr("Loading…", "Cargando…")}</p>;
  return <ul className="plain">{items.map(([d, text]) => <li key={d + text}><strong>{date(d)}</strong>: {text}</li>)}</ul>;
}

export default function Status() {
  const notes = [
    { id: "log", text: tr("From the site's public update log (the ingest_runs table). A record count is the rows added, changed or removed in that run. 'Late' means no successful update in more than 30 hours for twice-daily jobs, or eight and a half days for weekly ones.", "Del registro público de actualizaciones del sitio (la tabla ingest_runs). El conteo es de filas agregadas, cambiadas o eliminadas en esa ejecución. 'Atrasado' significa que no hubo una actualización correcta en más de 30 horas para los trabajos de dos veces al día, u ocho días y medio para los semanales.") },
    { id: "gh", text: <>{tr("From the site's public job history on ", "Del historial público de trabajos del sitio en ")}<a href={`https://github.com/${REPO}/actions`}>GitHub</a>.</> },
  ];
  return (
    <NotesProvider notes={notes}>
      <main className="page wide status-page">
        <h1>{tr("Site status", "Estado del sitio")}</h1>
        <p className="lede">{tr("When each kind of record was last updated from its source, how the latest automated checks went, and dates coming up when records change.", "Cuándo se actualizó cada tipo de registro desde su fuente, cómo salieron las últimas verificaciones automáticas y las fechas próximas en que cambian los registros.")} <Link to="/methods">{tr("How this site works", "Cómo funciona este sitio")}</Link>.</p>
        <section>
          <h2>{tr("Data updates", "Actualizaciones de datos")}<Ref id="log" /></h2>
          <DataJobs />
        </section>
        <section>
          <h2>{tr("Automated checks", "Verificaciones automáticas")}<Ref id="gh" /></h2>
          <Checks />
          <h3>{tr("Facts checked against their sources", "Datos verificados contra sus fuentes")}</h3>
          <AccuracyStatus />
        </section>
        <section>
          <h2>{tr("Coming up", "Próximamente")}</h2>
          <ComingUp />
        </section>
        <NotesList />
      </main>
    </NotesProvider>
  );
}
