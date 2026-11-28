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
import { FloorItems } from "../components/ComingUp.jsx";
import SectionCard, { Stat, Stats } from "../components/SectionCard.jsx";
import { PartyTag } from "../components/PartyTag.jsx";
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
  const { open, toggle, reveal } = useFolds(["floor", "committees", "passed", "votes"], true, "week");
  const [people, setPeople] = useState([]);
  useEffect(() => {
    if (!mine.size) return;
    db.from("member_directory").select("bioguide_id,name,chamber,state,district,party").in("bioguide_id", [...mine])
      .then(({ data }) => setPeople(data ?? []));
  }, [mine]);

  // Counts for the summary: the next House floor week, committee meetings in the next two
  // weeks, and when the Senate next meets (same reads as the home page's tile).
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const start = new Date(`${today}T12:00:00Z`); start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 14);
    db.from("upcoming_events").select("event_id,kind,event_date,event_time,chamber,committee_id,title,category,bill_refs,source_url")
      .gte("event_date", start.toISOString().slice(0, 10)).lte("event_date", end.toISOString().slice(0, 10)).limit(500)
      .then(({ data, error }) => {
        if (error) { setUpcoming({ ok: false, floorItems: [], meetings: [] }); return; }
        const rows = data ?? [];
        const floorWeek = rows.filter((e) => e.kind === "floor").map((e) => e.event_date).sort()[0];
        const meetings = rows.filter((e) => !["floor", "convene"].includes(e.kind) && e.event_date >= today);
        setUpcoming({ ok: true,
          floorWeek, floorItems: rows.filter((e) => e.kind === "floor" && e.event_date === floorWeek), meetings,
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
  const nFloor = up?.floorItems.length ?? 0;
  // "Nov 14–20" (or "Nov 28 – Dec 4") instead of two full dates.
  const span = (a, z) => {
    const d1 = new Date(`${a}T12:00:00Z`), d2 = new Date(`${z}T12:00:00Z`);
    const loc = tr("en-US", "es-US");
    const m = (d) => d.toLocaleDateString(loc, { month: "short", timeZone: "UTC" });
    return d1.getUTCMonth() === d2.getUTCMonth() ? `${m(d1)} ${d1.getUTCDate()}–${d2.getUTCDate()}` : `${m(d1)} ${d1.getUTCDate()} – ${m(d2)} ${d2.getUTCDate()}`;
  };
  const happened = !loading && votes.length > 0 && state.from;
  const wait = tr("Loading…", "Cargando…");
  const myMeetings = up ? up.meetings.filter((e) => myCommittees.has(e.committee_id) || myCommittees.has(e.committee_id?.slice(0, 4))).length : 0;
  const s = (n, one, many) => (n === 1 ? one : many);

  // Your members: how many of their chamber's roll calls each one has a recorded position on.
  const chamberVotes = (ch) => votes.filter((v) => v.chamber === ch).length;
  const memberLine = (m) => {
    const own = positions.filter((p) => p.bioguide_id === m.bioguide_id);
    const nv = own.filter((p) => p.position === "Not Voting").length;
    const total = chamberVotes(m.chamber);
    const where = m.chamber === "senate" ? tr("Senate", "del Senado") : tr("House", "de la Cámara");
    if (!total) return tr(`No ${where} roll calls that week.`, `No hubo votaciones nominales ${where} esa semana.`);
    return tr(`On ${own.length} of ${total} ${where} roll calls${nv ? `; listed as Not Voting on ${nv}` : ""}.`,
      `En ${own.length} de ${total} votaciones nominales ${where}${nv ? `; figura como Not Voting en ${nv}` : ""}.`);
  };

  return (
    <main className="page week-page">
      <h1>{tr("This week in Congress", "Esta semana en el Congreso")}</h1>
      <p className="lede">{tr("What Congress has scheduled next, and what it did in the last week with recorded votes.", "Lo que el Congreso tiene programado y lo que hizo en la última semana con votaciones registradas.")}</p>

      <SectionCard id="coming-up" title={tr("Coming up", "Próximamente")}
        sub={tr("As published by the House and Senate; schedules can change.", "Según lo publican la Cámara y el Senado; las agendas pueden cambiar.")}>
        {!up ? <p className="fine">{wait}</p> : !up.ok ? <p className="notice">{tr("Couldn't load the schedule right now.", "No se pudo cargar la agenda en este momento.")}</p> : <>
          <Stats>
            {up.floorWeek
              ? <Stat n={nFloor} href="#floor" onOpen={() => reveal("floor")} label={tr(`${s(nFloor, "item", "items")} on the House floor, week of ${date(up.floorWeek)}`, `${s(nFloor, "asunto", "asuntos")} en el pleno de la Cámara, semana del ${date(up.floorWeek)}`)} />
              : null}
            <Stat n={up.meetings.length} href="#committees" onOpen={() => reveal("committees")} label={tr(`committee ${s(up.meetings.length, "hearing or meeting", "hearings and meetings")}, next two weeks`, `${s(up.meetings.length, "audiencia o reunión", "audiencias y reuniones")} de comités, próximas dos semanas`)} />
          </Stats>
          <ul className="facts">
            <li><strong>{tr("House", "Cámara")}:</strong> {up.floorWeek ? tr(`floor schedule posted for the week of ${date(up.floorWeek)}.`, `agenda del pleno publicada para la semana del ${date(up.floorWeek)}.`) : tr("hasn't posted its next floor schedule yet. It usually comes out the Friday before.", "aún no ha publicado su próxima agenda del pleno. Suele publicarse el viernes anterior.")}</li>
            <li><strong>{tr("Senate", "Senado")}:</strong> {up.convene ? tr(`next meets ${date(up.convene.event_date)}${up.convene.event_time ? ` at ${up.convene.event_time}` : ""}.`, `se reúne el ${date(up.convene.event_date)}${up.convene.event_time ? ` a las ${up.convene.event_time}` : ""}.`) : tr("hasn't announced when it next meets.", "no ha anunciado cuándo se reúne de nuevo.")}</li>
          </ul>
          <div className="folds">
            {up.floorWeek && (
              <Fold id="floor" level={3} title={tr("House floor schedule", "Agenda del pleno de la Cámara")} count={nFloor} open={open.has("floor")} onToggle={toggle}
                summary={tr(`Week of ${date(up.floorWeek)}; may be considered`, `Semana del ${date(up.floorWeek)}; podría considerarse`)}>
                <p className="fine">{tr("The House lists the week's items by how they'll be considered, not by day.", "La Cámara publica los asuntos de la semana según cómo se considerarán, no por día.")}<Ref id="src-house-floor" text={<>{tr("Source", "Fuente")}: <a href="https://docs.house.gov/floor/">{tr("House Majority Leader's floor schedule", "agenda del pleno del Líder de la Mayoría de la Cámara")}</a> (docs.house.gov).</>} /></p>
                <FloorItems items={up.floorItems} />
              </Fold>
            )}
            <Fold id="committees" level={3} title={tr("Committee calendar", "Calendario de comités")} count={up.meetings.length} open={open.has("committees")} onToggle={toggle}
              summary={tr(`Hearings and meetings in the next two weeks${myMeetings ? `; ${myMeetings} on your representatives' committees` : ""}`, `Audiencias y reuniones en las próximas dos semanas${myMeetings ? `; ${myMeetings} en comités de sus representantes` : ""}`)}>
              <CommitteeCalendar mine={myCommittees} />
            </Fold>
          </div>
        </>}
      </SectionCard>

      <SectionCard id="last-week" title={happened ? tr(`Last week with votes: ${span(state.from, state.to)}`, `Última semana con votaciones: ${span(state.from, state.to)}`) : tr("Last week with votes", "Última semana con votaciones")}
        sub={tr("The most recent seven days with a roll-call vote in either chamber.", "Los siete días más recientes con una votación nominal en cualquiera de las cámaras.")}>
        {loading ? <p className="fine">{wait}</p> : !happened ? <p>{tr("No votes on record yet.", "Todavía no hay votos registrados.")}</p> : <>
          <Stats>
            <Stat n={laws.length} href="#laws" label={tr(s(laws.length, "became law", "became law"), s(laws.length, "se convirtió en ley", "se convirtieron en ley"))} />
            <Stat n={passed.length} href="#passed" onOpen={() => reveal("passed")} label={tr("passed the House or Senate", "aprobados por la Cámara o el Senado")} />
            <Stat n={votes.length} href="#votes" onOpen={() => reveal("votes")} label={tr(`roll-call ${s(votes.length, "vote", "votes")}, ${finals} final`, `${s(votes.length, "votación nominal", "votaciones nominales")}, ${finals} ${s(finals, "final", "finales")}`)} />
          </Stats>

          <div id="laws" className="list-group">
            <h3 className="list-group-head">{tr("Became law", "Se convirtieron en ley")} <span className="fold-count">{laws.length}</span></h3>
            {laws.length === 0 ? <p>{tr("None that week.", "Ninguno esa semana.")}</p> : (
              <ul className="dots">{laws.map((b) => (
                <li key={`${b.bill_type}${b.number}`}>
                  {billLink(b)} <span lang="en">{b.short_title ?? b.title}</span>
                  <span className="fine item-meta">{b.law_number} · {tr("signed", "firmado el")} {date(b.became_law_date)}</span>
                  <PlainLead map={plain} bill={b} />
                </li>
              ))}</ul>
            )}
            {vetoed.length > 0 && <p className="fine">{tr("Vetoed", "Vetados")}: {vetoed.map((b, i) => <span key={b.number}>{i ? "; " : ""}{billLink(b)} <span lang="en">{b.short_title ?? b.title}</span> ({date(b.vetoed_date)})</span>)}</p>}
          </div>

          <div className="folds">
            <Fold id="passed" level={3} title={tr("Passed a chamber", "Aprobados por una cámara")} count={passed.length} open={open.has("passed")} onToggle={toggle}
              summary={tr("Bills and resolutions passed by the House or Senate", "Proyectos y resoluciones aprobados por la Cámara o el Senado")}>
              {passed.length === 0 ? <p>{tr("None that week.", "Ninguno esa semana.")}</p> : (
                <ul className="dots">{passed.map((b) => (
                  <li key={`${b.bill_type}${b.number}`}>
                    {billLink(b)} <Clamp lines={2}>{b.short_title ?? b.title}</Clamp>
                    <span className="fine item-meta">{tr("passed the", "aprobado por:")} {passedWhere(b)}</span>
                    <PlainLead map={plain} bill={b} />
                  </li>
                ))}</ul>
              )}
              <p className="fine">{tr("Includes bills and resolutions passed by voice vote, which have no roll call.", "Incluye proyectos y resoluciones aprobados a viva voz, que no tienen votación nominal.")}</p>
            </Fold>
            <Fold id="votes" level={3} title={tr("Roll-call votes", "Votaciones nominales")} count={votes.length} open={open.has("votes")} onToggle={toggle}
              summary={tr(`${finals} final, ${date(state.from)} to ${date(state.to)}`, `${finals} ${s(finals, "final", "finales")}, ${date(state.from)} al ${date(state.to)}`)}>
              <p className="fine">{tr("Roll calls from the last week with votes.", "Votaciones de la última semana con votaciones.")}<Ref id="src" text={<>{tr("Sources: House Clerk and Senate.gov roll-call records; GovInfo Bill Status (Library of Congress).", "Fuentes: registros de votaciones del Secretario de la Cámara y de Senate.gov; GovInfo Bill Status (Biblioteca del Congreso).")}</>} /></p>
              <div className="toggle" role="group" aria-label={tr("Which votes to show", "Qué votos mostrar")}>
                <button type="button" aria-pressed={!allVotes} className={allVotes ? "" : "on"} onClick={() => setAllVotes(false)}>{tr(`Final votes (${finals})`, `Votos finales (${finals})`)}</button>
                <button type="button" aria-pressed={allVotes} className={allVotes ? "on" : ""} onClick={() => setAllVotes(true)}>{tr(`All ${votes.length} votes`, `Los ${votes.length} votos`)}</button>
              </div>
              {mine.size === 0 && <p className="fine"><Link to="/">{tr("Look up your address", "Busque su dirección")}</Link> {tr("to see how your representatives voted.", "para ver cómo votaron sus representantes.")}</p>}
              {shown.length === 0 ? <p>{tr("No final votes that week.", "No hubo votos finales esa semana.")}</p> : (
                <table className="vote-table">
                  <thead><tr><th>{tr("Date", "Fecha")}</th><th>{tr("Vote", "Votación")}</th><th>{tr("Result", "Resultado")}</th>{mine.size > 0 && <th>{tr("Your representatives", "Sus representantes")}</th>}</tr></thead>
                  <tbody>
                    {shown.map((v) => (
                      <tr key={v.vote_id}>
                        <td className="vt-date">{date(v.voted_at)}<div className="fine">{v.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")}</div></td>
                        <td className="vt-q">
                          <VoteMeaning v={v} />
                          <KindLabel v={v} /> <a href={v.source_url} lang="en">{v.question}</a>
                          <div className="fine">{v.bill_type ? billLink({ congress: v.bill_congress, bill_type: v.bill_type, number: v.bill_number }) : <LinkedText text={v.description} congress={congressOn(new Date(v.voted_at))} />}</div>
                        </td>
                        <td><VoteResult v={v} /><div className="fine">{v.yea_total}–{v.nay_total}</div></td>
                        {mine.size > 0 && <td className="fine vt-q" data-label={tr("Your representatives:", "Sus representantes:")}>{positions.filter((p) => p.vote_id === v.vote_id).map((p) => <div key={p.bioguide_id}><Link to={`/member/${p.bioguide_id}`}>{p.name}</Link>: <Position v={v} position={p.position} /></div>)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Fold>
          </div>
        </>}
      </SectionCard>

      {mine.size > 0 && (
        <SectionCard id="your-members" title={tr("Your members this week", "Sus miembros esta semana")}
          sub={tr("From the address you looked up on this device.", "Según la dirección que buscó en este dispositivo.")}>
          {loading || !people.length ? <p className="fine">{wait}</p> : (
            <ul className="dots">
              {people.map((m) => (
                <li key={m.bioguide_id}>
                  <Link to={`/member/${m.bioguide_id}`}>{m.name}</Link> <PartyTag p={m} />
                  <span className="item-meta">{memberLine(m)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="fine">
            {myMeetings > 0 && <>{tr(`${myMeetings} upcoming committee ${s(myMeetings, "meeting is", "meetings are")} on their committees. `, `${myMeetings} ${s(myMeetings, "reunión próxima es", "reuniones próximas son")} de sus comités. `)}</>}
            {votes.length > 0 && <><a href="#votes" onClick={(e) => { e.preventDefault(); reveal("votes"); }}>{tr("How they voted", "Cómo votaron")}</a> · </>}
            <Link to="/your-week">{tr("Your week, every level", "Su semana, todos los niveles")}</Link>
          </p>
        </SectionCard>
      )}
      <NotesList />
    </main>
  );
}
