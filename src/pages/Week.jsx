import { congressOn } from "../../lib/congress.js";
import LinkedText from "../components/LinkedText.jsx";
import { NotesList, Ref } from "../components/Notes.jsx";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, date } from "../lib/format.js";
import { isFinal } from "../lib/voteKind.js";
import { KindLabel, Position, VoteMeaning } from "../components/Explain.jsx";
import { myRepresentatives } from "../lib/myReps.js";
import ComingUp from "../components/ComingUp.jsx";
import CommitteeCalendar from "../components/CommitteeCalendar.jsx";
import { tr } from "../lib/lang.js";
import { Fold, useFolds } from "../components/Fold.jsx";
import Clamp from "../components/Clamp.jsx";
import VoteResult from "../components/VoteResult.jsx";
import { PlainLead } from "../components/PlainSummary.jsx";
import { usePlainSummaries } from "../lib/plainSummaries.js";

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);

// The most recent seven days with roll-call votes: what passed, what became law, and every
// recorded vote, with the visitor's representatives' positions if they looked them up.
export default function Week() {
  const [state, setState] = useState({ status: "loading" });
  const plain = usePlainSummaries([...(state.laws ?? []), ...(state.passed ?? [])]);
  const [allVotes, setAllVotes] = useState(false);
  const mine = useMemo(() => myRepresentatives(), []);
  const [upcoming, setUpcoming] = useState(null);
  const { open, toggle } = useFolds(["floor", "committees", "laws", "passed", "votes"], true, "week");

  // Counts for the summary: the next House floor week, committee meetings in the next two
  // weeks, and when the Senate next meets (same reads as the home page's tile).
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const start = new Date(`${today}T12:00:00Z`); start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 14);
    db.from("upcoming_events").select("kind,event_date,chamber,committee_id")
      .gte("event_date", start.toISOString().slice(0, 10)).lte("event_date", end.toISOString().slice(0, 10)).limit(500)
      .then(({ data }) => {
        const rows = data ?? [];
        const floorWeek = rows.filter((e) => e.kind === "floor").map((e) => e.event_date).sort()[0];
        const meetings = rows.filter((e) => !["floor", "convene"].includes(e.kind) && e.event_date >= today);
        setUpcoming({
          floorWeek, floor: rows.filter((e) => e.kind === "floor" && e.event_date === floorWeek).length, meetings,
          convene: rows.filter((e) => e.kind === "convene" && e.event_date >= today).sort((a, z) => a.event_date.localeCompare(z.event_date))[0],
        });
      });
  }, []);

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
        db.from("votes").select("vote_id,chamber,voted_at,question,description,document_name,result,required,amendment_ref,yea_total,nay_total,source_url,bill_congress,bill_type,bill_number")
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


  if (state.status === "error") return <main className="page"><h1>{tr("This week in Congress", "Esta semana en el Congreso")}</h1><p className="notice">{tr("Couldn't load this right now.", "No se pudo cargar en este momento.")}</p></main>;
  const loading = state.status === "loading";
  const { votes = [], laws = [], passed = [], vetoed = [], positions = [], myCommittees = new Set() } = state;
  const shown = votes.filter((v) => allVotes || isFinal(v));
  const billLink = (b) => <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link>;
  const passedWhere = (b) => [b.passed_house_date >= state.from && b.passed_house_date <= state.to && tr(`House (${date(b.passed_house_date)})`, `Cámara (${date(b.passed_house_date)})`),
    b.passed_senate_date >= state.from && b.passed_senate_date <= state.to && tr(`Senate (${date(b.passed_senate_date)})`, `Senado (${date(b.passed_senate_date)})`)].filter(Boolean).join(tr(" and ", " y "));

  const finals = votes.filter(isFinal).length;
  const up = upcoming;
  // "Nov 14–20" (or "Nov 28 – Dec 4") instead of two full dates.
  const span = (a, z) => {
    const d1 = new Date(`${a}T12:00:00Z`), d2 = new Date(`${z}T12:00:00Z`);
    const loc = tr("en-US", "es-US");
    const m = (d) => d.toLocaleDateString(loc, { month: "short", timeZone: "UTC" });
    return d1.getUTCMonth() === d2.getUTCMonth() ? `${m(d1)} ${d1.getUTCDate()}–${d2.getUTCDate()}` : `${m(d1)} ${d1.getUTCDate()} – ${m(d2)} ${d2.getUTCDate()}`;
  };
  // What's next, then what happened: the laws by name, the rest as counts. The topics below hold the detail.
  const next = up && [
    up.convene && tr(`The ${up.convene.chamber === "senate" ? "Senate" : "House"} next meets ${date(up.convene.event_date)}.`, `${up.convene.chamber === "senate" ? "El Senado" : "La Cámara"} se reúne el ${date(up.convene.event_date)}.`),
    up.floorWeek ? tr(`The House floor schedule for the week of ${date(up.floorWeek)} lists ${up.floor} item${up.floor === 1 ? "" : "s"}.`, `La agenda del pleno de la Cámara para la semana del ${date(up.floorWeek)} incluye ${up.floor} asunto${up.floor === 1 ? "" : "s"}.`)
      : tr("The House hasn't posted its next floor schedule yet.", "La Cámara aún no ha publicado su próxima agenda del pleno."),
  ].filter(Boolean).join(" ");
  const happened = !loading && votes.length > 0 && state.from;

  const wait = tr("Loading…", "Cargando…");
  const myMeetings = up ? up.meetings.filter((e) => myCommittees.has(e.committee_id) || myCommittees.has(e.committee_id?.slice(0, 4))).length : 0;

  return (
    <main className="page wide">
      <h1>{tr("This week in Congress", "Esta semana en el Congreso")}</h1>
      <section className="glance week-glance">
        <h2>{tr("Next", "Lo próximo")}</h2>
        <p>{next || tr("Loading…", "Cargando…")}</p>
        <h2>{happened ? tr(`Last week with votes: ${span(state.from, state.to)}`, `Última semana con votaciones: ${span(state.from, state.to)}`) : tr("Last week with votes", "Última semana con votaciones")}</h2>
        {!happened ? <p className="fine">{tr("Loading…", "Cargando…")}</p> : <>
          {laws.length > 0 && (
            <>
              <p>{laws.length === 1 ? tr("This became law:", "Esto se convirtió en ley:") : tr(`These ${laws.length} became law:`, `Estos ${laws.length} se convirtieron en ley:`)}</p>
              <ul className="bare glance-laws">
                {laws.slice(0, 6).map((b) => <li key={`${b.bill_type}${b.number}`}>{billLink(b)} <span lang="en" className="clamp2-inline">{b.short_title ?? b.title}</span></li>)}
              </ul>
            </>
          )}
          <p>{tr(`${passed.length} bill${passed.length === 1 ? "" : "s"} passed the House or Senate, and there were ${votes.length} roll-call vote${votes.length === 1 ? "" : "s"}, ${finals} of them final.`,
            `${passed.length} proyecto${passed.length === 1 ? "" : "s"} se aprobaron en la Cámara o el Senado, y hubo ${votes.length} votaci${votes.length === 1 ? "ón nominal" : "ones nominales"}, ${finals} final${finals === 1 ? "" : "es"}.`)}</p>
        </>}
      </section>

      <p className="fold-hint">{tr("Tap a topic to see the details.", "Toque un tema para ver los detalles.")}</p>
      <div className="folds">
      <Fold id="floor" title={tr("Floor schedule", "Agenda del pleno")} open={open.has("floor")} onToggle={toggle}
        summary={!up ? wait : up.floorWeek ? tr(`${up.floor} item${up.floor === 1 ? "" : "s"} on the House floor, week of ${date(up.floorWeek)}`, `${up.floor} asunto${up.floor === 1 ? "" : "s"} en el pleno de la Cámara, semana del ${date(up.floorWeek)}`) : tr("No House floor schedule posted yet", "Aún no hay agenda del pleno de la Cámara")}>
        <ComingUp myCommittees={myCommittees} committees={false} />
      </Fold>
      <Fold id="committees" title={tr("Committee calendar", "Calendario de comités")} open={open.has("committees")} onToggle={toggle}
        summary={!up ? wait : tr(`${up.meetings.length} hearings and meetings in the next two weeks${myMeetings ? `, ${myMeetings} on your representatives' committees` : ""}`, `${up.meetings.length} audiencias y reuniones en las próximas dos semanas${myMeetings ? `, ${myMeetings} en comités de sus representantes` : ""}`)}>
        <CommitteeCalendar mine={myCommittees} />
      </Fold>
      <Fold id="laws" title={tr("Became law", "Se convirtieron en ley")} open={open.has("laws")} onToggle={toggle} status={loading ? "loading" : undefined}
        summary={loading ? wait : tr(`${laws.length} in the last week with votes${vetoed.length ? `; ${vetoed.length} vetoed` : ""}`, `${laws.length} en la última semana con votaciones${vetoed.length ? `; ${vetoed.length} vetados` : ""}`)}>
          <section className="section">
            {laws.length === 0 ? <p>{tr("None this week.", "Ninguno esta semana.")}</p> : (
              <ul className="bare items">{laws.map((b) => <li key={`${b.bill_type}${b.number}`} className="item"><span className="item-head">{billLink(b)} <span className="fine">· {b.law_number} · {tr("signed", "firmado el")} {date(b.became_law_date)}</span></span><Clamp lines={2}>{b.short_title ?? b.title}</Clamp><PlainLead map={plain} bill={b} /></li>)}</ul>
            )}
            {vetoed.length > 0 && <p>{tr("Vetoed", "Vetados")}: {vetoed.map((b, i) => <span key={b.number}>{i ? "; " : ""}{billLink(b)} <span lang="en">{b.short_title ?? b.title}</span> ({date(b.vetoed_date)})</span>)}</p>}
          </section>
      </Fold>
      <Fold id="passed" title={tr("Passed a chamber", "Aprobados por una cámara")} open={open.has("passed")} onToggle={toggle} status={loading ? "loading" : undefined}
        summary={loading ? wait : tr(`${passed.length} passed the House or Senate in the last week with votes`, `${passed.length} aprobados por la Cámara o el Senado en la última semana con votaciones`)}>
          <section className="section">
            {passed.length === 0 ? <p>{tr("None this week.", "Ninguno esta semana.")}</p> : (
              <ul className="bare items">{passed.map((b) => <li key={`${b.bill_type}${b.number}`} className="item"><span className="item-head">{billLink(b)} <span className="fine">· {tr("passed the", "aprobado por:")} {passedWhere(b)}</span></span><Clamp lines={2}>{b.short_title ?? b.title}</Clamp><PlainLead map={plain} bill={b} /></li>)}</ul>
            )}
            <p className="fine">{tr("Includes bills and resolutions passed by voice vote, which have no roll call.", "Incluye proyectos y resoluciones aprobados a viva voz, que no tienen votación nominal.")}</p>
          </section>
      </Fold>
      <Fold id="votes" title={tr("Roll-call votes", "Votaciones nominales")} open={open.has("votes")} onToggle={toggle} status={loading ? "loading" : undefined}
        summary={loading ? wait : votes.length ? tr(`${finals} final vote${finals === 1 ? "" : "s"}, ${votes.length} in all, ${date(state.from)} to ${date(state.to)}`, `${finals} voto${finals === 1 ? "" : "s"} final${finals === 1 ? "" : "es"}, ${votes.length} en total, ${date(state.from)} al ${date(state.to)}`) : tr("No votes on record yet", "Todavía no hay votos registrados")}>
          <section className="section">
            <p className="fine">{tr("Roll calls from the last week with votes.", "Votaciones de la última semana con votaciones.")}<Ref id="src" text={<>{tr("Sources: House Clerk and Senate.gov roll-call records; GovInfo Bill Status (Library of Congress).", "Fuentes: registros de votaciones del Secretario de la Cámara y de Senate.gov; GovInfo Bill Status (Biblioteca del Congreso).")}</>} /></p>
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
                        <VoteMeaning v={v} />
                        <KindLabel v={v} /> <a href={v.source_url} lang="en">{v.question}</a>
                        <div className="fine">{v.bill_type ? billLink({ congress: v.bill_congress, bill_type: v.bill_type, number: v.bill_number }) : <LinkedText text={v.description} congress={congressOn(new Date(v.voted_at))} />}</div>
                      </td>
                      <td><VoteResult v={v} /><div className="fine">{v.yea_total}–{v.nay_total}</div></td>
                      {mine.size > 0 && <td className="fine">{positions.filter((p) => p.vote_id === v.vote_id).map((p) => <div key={p.bioguide_id}><Link to={`/member/${p.bioguide_id}`}>{p.name}</Link>: <Position v={v} position={p.position} /></div>)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
      </Fold>
      </div>
      <NotesList />
    </main>
  );
}
