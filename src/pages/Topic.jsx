import { NotesList, Ref } from "../components/Notes.jsx";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, ordinal, date } from "../lib/format.js";
import { areaFromSlug, areaName } from "../lib/policyAreas.js";
import { congressOn, congressYears } from "../../lib/congress.js";
import { KindLabel, VoteMeaning } from "../components/Explain.jsx";
import { tr } from "../lib/lang.js";
import Clamp from "../components/Clamp.jsx";

const CURRENT = congressOn();
const BILL = "congress,bill_type,number,title,short_title,latest_action_date,latest_action_text,became_law_date,law_number,passed_house_date,passed_senate_date";

// One subject across a Congress: what became law, what passed a chamber, the bills most
// organizations lobbied on, and recent roll-call votes. Lists only; no ranking of members.
export default function Topic() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const congress = Number(params.get("congress")) || CURRENT;
  const area = areaFromSlug(slug);
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    if (!area) { setState({ status: "missing" }); return; }
    setState({ status: "loading" });
    const base = () => db.from("bills").select(BILL).eq("congress", congress).eq("policy_area", area);
    Promise.all([
      db.from("topic_stats").select("*").eq("congress", congress).eq("policy_area", area).maybeSingle(),
      base().not("became_law_date", "is", null).order("became_law_date", { ascending: false }).limit(100),
      base().is("became_law_date", null).or("passed_house_date.not.is.null,passed_senate_date.not.is.null")
        .order("latest_action_date", { ascending: false }).limit(50),
      db.from("bill_list_lobbied").select("congress,bill_type,number,title,short_title,lobbying_clients")
        .eq("congress", congress).eq("policy_area", area).order("lobbying_clients", { ascending: false }).limit(10),
      db.from("vote_list").select("*").eq("congress", congress).eq("policy_area", area).order("voted_at", { ascending: false }).limit(25),
    ]).then(([stats, laws, passed, lobbied, votes]) => {
      const err = [stats, laws, passed, lobbied, votes].find((r) => r.error);
      setState(err ? { status: "error" } : { status: "done", stats: stats.data, laws: laws.data, passed: passed.data, lobbied: lobbied.data, votes: votes.data });
    });
  }, [area, congress]);

  if (state.status === "missing") return <main className="page"><h1>{tr("Topic not found", "Tema no encontrado")}</h1><p><Link to="/topics">{tr("All topics", "Todos los temas")}</Link></p></main>;
  if (state.status === "error") return <main className="page"><p className="notice">{tr("Couldn't load this topic right now.", "No se pudo cargar este tema en este momento.")}</p></main>;
  const link = (b) => <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link>;
  const s = state.stats;

  return (
    <main className="page wide">
      <p className="fine"><Link to="/topics">{tr("Topics", "Temas")}</Link></p>
      <h1>{areaName(area)}<Ref id="src" text={<>{tr("Sources: GovInfo Bill Status (Library of Congress); House Clerk and Senate.gov roll calls; LDA.gov.", "Fuentes: GovInfo Bill Status (Biblioteca del Congreso); votaciones del Secretario de la Cámara y de Senate.gov; LDA.gov.")}</>} /></h1>
      <div className="filters">
        <label>{tr("Congress", "Congreso")}{" "}
          <select value={congress} onChange={(e) => setParams({ congress: e.target.value })}>
            {Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i).map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
          </select>
        </label>
      </div>
      {state.status === "loading" ? <p>{tr("Loading…", "Cargando…")}</p> : (
        <>
          <p className="lede">
            {s ? tr(`In the ${ordinal(congress)} Congress, ${s.bills.toLocaleString()} bills and resolutions on this topic were introduced; ${s.passed_any.toLocaleString()} passed at least one chamber and ${s.laws.toLocaleString()} became law.`,
                `En el ${ordinal(congress)} Congreso se presentaron ${s.bills.toLocaleString()} proyectos y resoluciones sobre este tema; ${s.passed_any.toLocaleString()} se aprobaron en al menos una cámara y ${s.laws.toLocaleString()} se convirtieron en ley.`)
              : tr(`No bills on this topic in the ${ordinal(congress)} Congress yet.`, `Todavía no hay proyectos sobre este tema en el ${ordinal(congress)} Congreso.`)}
          </p>
          <p><Link to={`/bills?congress=${congress}&issue=${encodeURIComponent(area)}`}>{tr("Browse every bill on this topic →", "Ver todos los proyectos sobre este tema →")}</Link></p>

          <section className="section">
            <h2>{tr("Became law", "Se convirtieron en ley")}</h2>
            {state.laws.length === 0 ? <p>{tr("None yet.", "Ninguno todavía.")}</p> : (
              <ul className="bare items">{state.laws.map((b) => <li key={b.number + b.bill_type} className="item"><span className="item-head">{link(b)} <span className="fine">· {b.law_number}, {date(b.became_law_date)}</span></span><Clamp lines={2}>{b.short_title ?? b.title}</Clamp></li>)}</ul>
            )}
          </section>

          <section className="section">
            <h2>{tr("Passed one chamber or more, not yet law", "Aprobados por una o más cámaras, todavía no son ley")}</h2>
            {state.passed.length === 0 ? <p>{tr("None.", "Ninguno.")}</p> : (
              <ul className="plain">{state.passed.map((b) => (
                <li key={b.number + b.bill_type} className="item">{link(b)} <Clamp lines={2}>{b.short_title ?? b.title}</Clamp>
                  <div className="fine">{[b.passed_house_date && tr(`Passed House ${date(b.passed_house_date)}`, `Aprobado por la Cámara el ${date(b.passed_house_date)}`), b.passed_senate_date && tr(`Passed Senate ${date(b.passed_senate_date)}`, `Aprobado por el Senado el ${date(b.passed_senate_date)}`)].filter(Boolean).join(" · ")}</div></li>
              ))}</ul>
            )}
            {state.passed.length === 50 && <p className="fine">{tr("Showing the 50 with the most recent action.", "Se muestran los 50 con la acción más reciente.")}</p>}
          </section>

          <section className="section">
            <h2>{tr("Bills the most organizations lobbied on", "Proyectos con más organizaciones haciendo cabildeo")}</h2>
            {state.lobbied.length === 0 ? <p>{tr("No lobbying reports name bills on this topic yet.", "Ningún informe de cabildeo menciona todavía proyectos sobre este tema.")}</p> : (
              <ul className="bare items">{state.lobbied.map((b) => <li key={b.number + b.bill_type} className="item"><span className="item-head">{link(b)} <span className="fine">· {b.lobbying_clients.toLocaleString()} {tr("organizations", "organizaciones")}</span></span><Clamp lines={2}>{b.short_title ?? b.title}</Clamp></li>)}</ul>
            )}
            <p className="fine">{tr("From LD-2 lobbying reports that name the bill. A listing doesn't say whether the organization supported or opposed it. The Senate Office of Public Records can't vouch for data or analyses derived from these reports after they're retrieved.", "De informes de cabildeo LD-2 que mencionan el proyecto. La mención no dice si la organización lo apoyaba o se oponía. La Oficina de Registros Públicos del Senado no puede garantizar los datos ni los análisis derivados de estos informes después de obtenerlos.")}</p>
          </section>

          <section className="section">
            <h2>{tr("Recent roll-call votes", "Votaciones nominales recientes")}</h2>
            {state.votes.length === 0 ? <p>{tr("None recorded.", "Ninguna registrada.")}</p> : (
              <table>
                <thead><tr><th>{tr("Date", "Fecha")}</th><th>{tr("Vote", "Votación")}</th><th>{tr("Result", "Resultado")}</th></tr></thead>
                <tbody>
                  {state.votes.map((v) => (
                    <tr key={v.vote_id}>
                      <td>{date(v.voted_at)}<div className="fine">{v.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")}</div></td>
                      <td><VoteMeaning v={v} /><KindLabel v={v} /> <a href={v.source_url}>{v.question}</a>
                        <div className="fine">{link({ congress: v.bill_congress, bill_type: v.bill_type, number: v.bill_number })} {v.bill_title}</div></td>
                      <td>{v.result}<div className="fine">{v.yea_total}–{v.nay_total}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
      <NotesList />
    </main>
  );
}
