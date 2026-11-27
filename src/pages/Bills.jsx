import { topicSlug } from "../lib/policyAreas.js";
import { NotesList, Ref } from "../components/Notes.jsx";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import DownloadCsv from "../components/DownloadCsv.jsx";
import { POLICY_AREAS, areaName } from "../lib/policyAreas.js";
import { congressOn, congressYears } from "../../lib/congress.js";
import { billLabel, ordinal, partyTag, date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { PartyTag } from "../components/PartyTag.jsx";
import Clamp from "../components/Clamp.jsx";
import { billTrack, trackShort } from "../../lib/billTrack.js";

const SORTS = {
  action: { label: "Most recent action", es: "Acción más reciente", column: "latest_action_date" },
  introduced: { label: "Most recently introduced", es: "Presentados más recientemente", column: "introduced_date" },
  lobbying: { label: "Most organizations lobbying", es: "Más organizaciones haciendo cabildeo", column: "lobbying_clients" },
};
const PAGE = 50;
const STAGE = "congress,bill_type,number,title,introduced_date,reported_date,passed_house_date,failed_house_date,passed_senate_date,failed_senate_date,presented_date,vetoed_date,became_law_date,law_number";

// Milestone dates for one page of rows, keyed "type-number" (bill_list doesn't carry them).
async function loadStages(congress, rows) {
  if (!rows.length) return {};
  const { data, error } = await db.from("bills").select(STAGE).eq("congress", congress)
    .or(rows.map((r) => `and(bill_type.eq.${r.bill_type},number.eq.${r.number})`).join(","));
  if (error) return {};
  return Object.fromEntries(data.map((b) => [`${b.bill_type}-${b.number}`, b]));
}
const CURRENT = congressOn();
// Coverage starts with the 118th Congress.
const CONGRESS_OPTIONS = Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i);

export default function Bills() {
  const [params, setParams] = useSearchParams();
  const congress = Number(params.get("congress")) || CURRENT;
  const issue = params.get("issue") ?? "";
  const sort = SORTS[params.get("sort")] ? params.get("sort") : "action";
  const page = Math.max(0, Number(params.get("page")) || 0);
  const [state, setState] = useState({ status: "loading", rows: [] });
  const [stages, setStages] = useState({});
  const set = (k, v) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    if (k !== "page") n.delete("page");
    setParams(n);
  };

  useEffect(() => {
    setState((s) => ({ ...s, status: "loading" }));
    // "Most lobbying" reads a view that starts from the per-bill totals (fast); others read all bills.
    let q = db.from(sort === "lobbying" ? "bill_list_lobbied" : "bill_list")
      .select("congress,bill_type,number,title,short_title,introduced_date,latest_action_date,latest_action_text,policy_area,sponsor_bioguide_id,sponsor_name,sponsor_party,sponsor_chamber,sponsor_state,sponsor_district,lobbying_clients")
      .eq("congress", congress);
    if (issue) q = q.eq("policy_area", issue);
    q.order(SORTS[sort].column, { ascending: false, nullsFirst: false }).order("number")
      .range(page * PAGE, page * PAGE + PAGE - 1)
      .then(({ data, error }) => {
        setState(error ? { status: "error", rows: [] } : { status: "done", rows: data });
        // The stage line is extra; if it fails the rows still show.
        if (!error) loadStages(congress, data).then(setStages, () => setStages({}));
      });
  }, [congress, issue, sort, page]);

  return (
    <main className="page wide">
      <h1>{tr("Bills", "Proyectos de ley")}<Ref id="src" text={<>{tr(`Source: GovInfo Bill Status (Library of Congress); ${ordinal(congress)} Congress. Lobbying counts are organizations whose LD-2 reports name the bill`,
          `Fuente: GovInfo Bill Status (Biblioteca del Congreso); ${ordinal(congress)} Congreso. Los conteos de cabildeo son organizaciones cuyos informes LD-2 mencionan el proyecto`)}{" "}
        (<Link to="/methods#lobbying">{tr("how they're counted", "cómo se cuentan")}</Link>). {tr("The Senate Office of Public Records can't vouch for data or analyses derived from these reports after they're retrieved.", "La Oficina de Registros Públicos del Senado no puede garantizar los datos ni los análisis derivados de estos informes después de obtenerlos.")}</>} /></h1>
      <div className="filters">
        <label>{tr("Congress", "Congreso")}{" "}
          <select value={congress} onChange={(e) => set("congress", e.target.value)}>
            {CONGRESS_OPTIONS.map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
          </select>
        </label>
        <label>{tr("Issue", "Tema")}{" "}
          <select value={issue} onChange={(e) => set("issue", e.target.value)}>
            <option value="">{tr("All issues", "Todos los temas")}</option>
            {POLICY_AREAS.map((a) => <option key={a} value={a}>{areaName(a)}</option>)}
          </select>
        </label>
        <label>{tr("Sort", "Ordenar")}{" "}
          <select value={sort} onChange={(e) => set("sort", e.target.value)}>
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{tr(s.label, s.es)}</option>)}
          </select>
        </label>
      </div>
      {state.status === "error" && <p className="notice">{tr("Couldn't load bills right now.", "No se pudieron cargar los proyectos en este momento.")}</p>}
      {state.status === "loading" && state.rows.length === 0 && <p>{tr("Loading…", "Cargando…")}</p>}
      {state.rows.length === 0 && state.status === "done" && (congress === CURRENT && !issue && page === 0 ? (
        // A new Congress (Jan 3) has no bills until members introduce them and GovInfo publishes them.
        <p>{tr(`No bills from the ${ordinal(CURRENT)} Congress are in the record yet. Bills appear here as they're introduced and published by GovInfo. `,
          `Todavía no hay proyectos del ${ordinal(CURRENT)} Congreso en el registro. Los proyectos aparecen aquí a medida que se presentan y GovInfo los publica. `)}
          <Link to={`/bills?congress=${CURRENT - 1}`}>{tr(`Bills of the ${ordinal(CURRENT - 1)} Congress`, `Proyectos del ${ordinal(CURRENT - 1)} Congreso`)}</Link></p>
      ) : <p>{tr("No bills match.", "Ningún proyecto coincide.")}</p>)}
      {state.rows.length > 0 && (
        <table className={`bill-table${state.status === "loading" ? " dim" : ""}`}>
          <thead><tr><th>{tr("Bill", "Proyecto")}</th><th>{tr("Sponsor", "Patrocinador")}</th><th>{tr("Latest action", "Última acción")}</th>{sort === "lobbying" && <th>{tr("Lobbying", "Cabildeo")}</th>}</tr></thead>
          <tbody>
            {state.rows.map((b) => (
              <tr key={`${b.bill_type}-${b.number}`}>
                <td>
                  <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link> <Clamp lines={2}>{b.short_title ?? b.title}</Clamp>
                  {b.policy_area && <div className="fine"><Link to={`/topic/${topicSlug(b.policy_area)}?congress=${b.congress}`}>{areaName(b.policy_area)}</Link></div>}
                {stages[`${b.bill_type}-${b.number}`] && (() => { const l = trackShort(billTrack(stages[`${b.bill_type}-${b.number}`]), date); return <div className="fine stage-line">{tr(l.en, l.es)}</div>; })()}
                </td>
                <td data-label={tr("Sponsor:", "Patrocinador:")}>{b.sponsor_bioguide_id
                  ? <><Link to={`/member/${b.sponsor_bioguide_id}`}>{b.sponsor_name}</Link>{b.sponsor_party && <> <PartyTag p={{ party: b.sponsor_party, chamber: b.sponsor_chamber, state: b.sponsor_state, district: b.sponsor_district }} /></>}</>
                  : ""}</td>
                <td><span className="fine">{date(b.latest_action_date)}</span><div>{b.latest_action_text}</div></td>
                {sort === "lobbying" && <td>{b.lobbying_clients.toLocaleString()}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <DownloadCsv rows={state.rows} filename={`bills-${congress}${issue ? `-${issue.toLowerCase().replace(/[^a-z]+/g, "-")}` : ""}-p${page + 1}`}
        note={tr("this page of results", "esta página de resultados")} columns={[
        ["Bill", (b) => `${b.bill_type.toUpperCase()} ${b.number}`], ["Congress", (b) => b.congress], ["Title", (b) => b.short_title ?? b.title],
        ["Issue", (b) => b.policy_area], ["Sponsor", (b) => b.sponsor_name], ["Sponsor party", (b) => b.sponsor_party], ["Sponsor state", (b) => b.sponsor_state],
        ["Introduced", (b) => b.introduced_date], ["Latest action date", (b) => b.latest_action_date], ["Latest action", (b) => b.latest_action_text],
        ["Organizations lobbying", (b) => b.lobbying_clients], ["Page", (b) => `${window.location.origin}/bill/${b.congress}/${b.bill_type}/${b.number}`],
      ]} />
      <p className="pager">
        {page > 0 && <button className="link" onClick={() => set("page", String(page - 1))}>{tr("← Previous", "← Anterior")}</button>}
        {state.rows.length === PAGE && <button className="link" onClick={() => set("page", String(page + 1))}>{tr("Next →", "Siguiente →")}</button>}
      </p>
      <NotesList />
    </main>
  );
}
