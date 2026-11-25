import { NotesList, Ref } from "../components/Notes.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, date } from "../lib/format.js";
import { isFinal } from "../lib/voteKind.js";
import { KindLabel, Position } from "../components/Explain.jsx";
import { myRepresentatives } from "../lib/myReps.js";
import ComingUp from "../components/ComingUp.jsx";
import CommitteeCalendar from "../components/CommitteeCalendar.jsx";
import { tr } from "../lib/lang.js";
import Clamp from "../components/Clamp.jsx";

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);

// The most recent seven days with roll-call votes: what passed, what became law, and every
// recorded vote, with the visitor's representatives' positions if they looked them up.
export default function Week() {
  const [state, setState] = useState({ status: "loading" });
  const [allVotes, setAllVotes] = useState(false);
  const mine = useMemo(() => myRepresentatives(), []);

  useEffect(() => {
    (async () => {
      const { data: last, error: e1 } = await db.from("votes").select("voted_at").order("voted_at", { ascending: false }).limit(1);
      if (e1) throw e1;
      if (!last.length) { setState({ status: "done", votes: [], myCommittees: new Set() }); return; }
      const end = new Date(last[0].voted_at);
      const start = new Date(end.getTime() - 6 * DAY);
      const from = iso(start), to = iso(end);
      const cols = "congress,bill_type,number,title,short_title,passed_house_date,passed_senate_date,became_law_date,law_number,vetoed_date";
      const [votes, laws, passed, vetoed] = await Promise.all([
        db.from("votes").select("vote_id,chamber,voted_at,question,description,document_name,result,yea_total,nay_total,source_url,bill_congress,bill_type,bill_number")
          .gte("voted_at", `${from}T00:00:00Z`).order("voted_at", { ascending: false }).limit(500),
        db.from("bills").select(cols).gte("became_law_date", from).lte("became_law_date", to),
        db.from("bills").select(cols).or(`and(passed_house_date.gte.${from},passed_house_date.lte.${to}),and(passed_senate_date.gte.${from},passed_senate_date.lte.${to})`).limit(200),
        db.from("bills").select(cols).gte("vetoed_date", from).lte("vetoed_date", to),
      ]);
      for (const r of [votes, laws, passed, vetoed]) if (r.error) throw r.error;
      let positions = [];
      let myCommittees = new Set();
      if (mine.size) {
        const { data: cm } = await db.from("committee_memberships").select("committee_id,congress").in("bioguide_id", [...mine]);
        const latest = Math.max(0, ...(cm ?? []).map((r) => r.congress));
        myCommittees = new Set((cm ?? []).filter((r) => r.congress === latest).map((r) => r.committee_id));
      }
      if (mine.size && votes.data.length) {
        const { data } = await db.from("vote_position_details").select("vote_id,bioguide_id,name,position")
          .in("vote_id", votes.data.map((v) => v.vote_id)).in("bioguide_id", [...mine]);
        positions = data ?? [];
      }
      setState({ status: "done", from, to, votes: votes.data, laws: laws.data, passed: passed.data, vetoed: vetoed.data, positions, myCommittees });
    })().catch(() => setState({ status: "error" }));
  }, [mine]);

  if (state.status === "loading") return <main className="page"><h1>{tr("This week in Congress", "Esta semana en el Congreso")}</h1><p>{tr("Loading…", "Cargando…")}</p></main>;
  if (state.status === "error") return <main className="page"><h1>{tr("This week in Congress", "Esta semana en el Congreso")}</h1><p className="notice">{tr("Couldn't load this right now.", "No se pudo cargar en este momento.")}</p></main>;
  const { votes, laws = [], passed = [], vetoed = [], positions = [], myCommittees } = state;
  const shown = votes.filter((v) => allVotes || isFinal(v));
  const billLink = (b) => <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link>;
  const passedWhere = (b) => [b.passed_house_date >= state.from && b.passed_house_date <= state.to && tr(`House (${date(b.passed_house_date)})`, `Cámara (${date(b.passed_house_date)})`),
    b.passed_senate_date >= state.from && b.passed_senate_date <= state.to && tr(`Senate (${date(b.passed_senate_date)})`, `Senado (${date(b.passed_senate_date)})`)].filter(Boolean).join(tr(" and ", " y "));

  return (
    <main className="page wide">
      <h1>{tr("This week in Congress", "Esta semana en el Congreso")}</h1>
      <ul className="level-jump" aria-label={tr("Jump to", "Ir a")}>
        <li><a href="#floor">{tr("Floor schedule", "Agenda del pleno")}</a></li>
        <li><a href="#committees">{tr("Committee calendar", "Calendario de comités")}</a></li>
        <li><a href="#last-week">{tr("Last week's votes", "Votos de la semana pasada")}</a></li>
      </ul>
      <section className="section" id="floor">
        <h2>{tr("Coming up", "Próximamente")}</h2>
        <ComingUp myCommittees={myCommittees} committees={false} />
      </section>

      <section className="section" id="committees">
        <h2>{tr("Committee hearings and markups", "Audiencias y sesiones de comités")}</h2>
        <CommitteeCalendar mine={myCommittees} />
      </section>

      {votes.length === 0 ? <p>{tr("No votes on record yet.", "Todavía no hay votos registrados.")}</p> : (
        <>
          <h2 className="week-head" id="last-week">{tr("Last week with votes", "Última semana con votaciones")}: {date(state.from)} {tr("to", "al")} {date(state.to)}<Ref id="src" text={<>{tr("Sources: House Clerk and Senate.gov roll-call records; GovInfo Bill Status (Library of Congress).", "Fuentes: registros de votaciones del Secretario de la Cámara y de Senate.gov; GovInfo Bill Status (Biblioteca del Congreso).")}</>} /></h2>

          <section className="section">
            <h2>{tr("Became law", "Se convirtieron en ley")}</h2>
            {laws.length === 0 ? <p>{tr("None this week.", "Ninguno esta semana.")}</p> : (
              <ul className="bare items">{laws.map((b) => <li key={`${b.bill_type}${b.number}`} className="item"><span className="item-head">{billLink(b)} <span className="fine">· {b.law_number} · {tr("signed", "firmado el")} {date(b.became_law_date)}</span></span><Clamp lines={2}>{b.short_title ?? b.title}</Clamp></li>)}</ul>
            )}
            {vetoed.length > 0 && <p>{tr("Vetoed", "Vetados")}: {vetoed.map((b, i) => <span key={b.number}>{i ? "; " : ""}{billLink(b)} {b.short_title ?? b.title} ({date(b.vetoed_date)})</span>)}</p>}
          </section>

          <section className="section">
            <h2>{tr("Passed a chamber", "Aprobados por una cámara")}</h2>
            {passed.length === 0 ? <p>{tr("None this week.", "Ninguno esta semana.")}</p> : (
              <ul className="bare items">{passed.map((b) => <li key={`${b.bill_type}${b.number}`} className="item"><span className="item-head">{billLink(b)} <span className="fine">· {tr("passed the", "aprobado por:")} {passedWhere(b)}</span></span><Clamp lines={2}>{b.short_title ?? b.title}</Clamp></li>)}</ul>
            )}
            <p className="fine">{tr("Includes bills and resolutions passed by voice vote, which have no roll call.", "Incluye proyectos y resoluciones aprobados a viva voz, que no tienen votación nominal.")}</p>
          </section>

          <section className="section">
            <h2>{tr("Roll-call votes", "Votaciones nominales")}</h2>
            <div className="toggle" role="group" aria-label={tr("Which votes to show", "Qué votos mostrar")}>
              <button type="button" aria-pressed={!allVotes} className={allVotes ? "" : "on"} onClick={() => setAllVotes(false)}>{tr("Final votes", "Votos finales")}</button>
              <button type="button" aria-pressed={allVotes} className={allVotes ? "on" : ""} onClick={() => setAllVotes(true)}>{tr(`All ${votes.length} votes`, `Los ${votes.length} votos`)}</button>
            </div>
            {mine.size === 0 && <p className="fine"><Link to="/">{tr("Look up your address", "Busque su dirección")}</Link> {tr("to see how your representatives voted.", "para ver cómo votaron sus representantes.")}</p>}
            {shown.length === 0 ? <p>{tr("No final votes this week.", "No hubo votos finales esta semana.")}</p> : (
              <table>
                <thead><tr><th>{tr("Date", "Fecha")}</th><th>{tr("Vote", "Votación")}</th><th>{tr("Result", "Resultado")}</th>{mine.size > 0 && <th>{tr("Your representatives", "Sus representantes")}</th>}</tr></thead>
                <tbody>
                  {shown.map((v) => (
                    <tr key={v.vote_id}>
                      <td>{date(v.voted_at)}<div className="fine">{v.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")}</div></td>
                      <td>
                        <KindLabel v={v} /> <a href={v.source_url}>{v.question}</a>
                        <div className="fine">{v.bill_type ? billLink({ congress: v.bill_congress, bill_type: v.bill_type, number: v.bill_number }) : v.description}</div>
                      </td>
                      <td>{v.result}<div className="fine">{v.yea_total}–{v.nay_total}</div></td>
                      {mine.size > 0 && <td className="fine">{positions.filter((p) => p.vote_id === v.vote_id).map((p) => <div key={p.bioguide_id}><Link to={`/member/${p.bioguide_id}`}>{p.name}</Link>: <Position v={v} position={p.position} /></div>)}</td>}
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
