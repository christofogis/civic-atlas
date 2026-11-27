import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { NotesList, Ref } from "../components/Notes.jsx";
import Portrait from "../components/Portrait.jsx";
import { PartyTag } from "../components/PartyTag.jsx";
import VoteBreakdown from "../components/VoteBreakdown.jsx";
import { date, ordinal } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { congressOn } from "../../lib/congress.js";
import { currentRoles, isChamberPost, speakerElections, todayEastern } from "../../lib/leadership.js";

const CURRENT = congressOn();
const photo = (id) => `https://unitedstates.github.io/images/congress/225x275/${id}.jpg`;
const CHAMBERS = [["house", () => tr("House", "Cámara de Representantes")], ["senate", () => tr("Senate", "Senado")]];
const isChair = (t) => /^chair/i.test(t ?? "");
const isRanking = (t) => /ranking member/i.test(t ?? "");

// Who leads each chamber and its committees, and every recorded election of the Speaker.
export default function Leadership() {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    (async () => {
      const today = todayEastern();
      const [roles, votes, tallies, committees, posts] = await Promise.all([
        db.from("leadership_roles").select("bioguide_id,chamber,title,start_date,end_date").limit(2000),
        db.from("votes").select("vote_id,congress,session,roll_number,voted_at,result,source_url")
          .eq("chamber", "house").eq("question", "Election of the Speaker").order("voted_at", { ascending: false }).limit(500),
        db.from("speaker_ballot_tallies").select("vote_id,position,position_category,votes").limit(5000),
        db.from("committees").select("committee_id,name,chamber").is("parent_id", null).order("name"),
        db.from("committee_memberships").select("congress,committee_id,bioguide_id,title")
          .lte("congress", CURRENT).or("title.ilike.chair*,title.ilike.ranking member*").order("congress", { ascending: false }).limit(2000),
      ]);
      const now = roles.error ? null : currentRoles(roles.data, today);
      // The latest Congress with committee leaders on record, normally the current one.
      const committeeCongress = posts.data?.[0]?.congress ?? null;
      const committeePosts = (posts.data ?? []).filter((p) => p.congress === committeeCongress);
      const ids = [...new Set([...(now ?? []).map((r) => r.bioguide_id), ...committeePosts.map((p) => p.bioguide_id)])];
      const { data: people } = ids.length
        ? await db.from("member_directory").select("bioguide_id,name,party,chamber,state,district").in("bioguide_id", ids)
        : { data: [] };
      const byVote = new Map();
      for (const t of tallies.data ?? []) byVote.set(t.vote_id, [...(byVote.get(t.vote_id) ?? []), t]);
      setState({
        status: "done",
        roles: now,
        people: new Map((people ?? []).map((p) => [p.bioguide_id, p])),
        elections: votes.error || tallies.error ? null : speakerElections(votes.data ?? [], byVote),
        committees: committees.error || posts.error ? null : committees.data ?? [],
        committeePosts, committeeCongress,
      });
    })().catch(() => setState({ status: "error" }));
  }, []);

  if (state.status === "loading") return <main className="page"><h1>{tr("Congressional leadership", "Liderazgo del Congreso")}</h1><p>{tr("Loading…", "Cargando…")}</p></main>;
  if (state.status === "error") return <main className="page"><h1>{tr("Congressional leadership", "Liderazgo del Congreso")}</h1><p className="notice">{tr("Couldn't load leadership right now.", "No se pudo cargar el liderazgo en este momento.")}</p></main>;
  const { roles, people, elections, committees, committeePosts, committeeCongress } = state;

  return (
    <main className="page wide">
      <h1>{tr("Congressional leadership", "Liderazgo del Congreso")}</h1>
      <p className="lede">{tr(
        "Who holds each leadership post in the House and Senate, how the House elected its Speaker, and who chairs each committee and is its ranking member.",
        "Quién ocupa cada cargo de liderazgo en la Cámara y el Senado, cómo eligió la Cámara a su Presidente (Speaker) y quién preside cada comité y es su miembro de mayor rango de la minoría.")}</p>

      <h2>{tr(`Leaders in the ${ordinal(CURRENT)} Congress`, `Líderes en el ${ordinal(CURRENT)} Congreso`)}<Ref id="src-leaders" text={<>
        {tr("Source: ", "Fuente: ")}<a href="https://github.com/unitedstates/congress-legislators">unitedstates/congress-legislators</a>
        {tr(" (public domain), which lists each member's leadership posts with start and end dates. Titles are shown as published there. Official lists: ",
          " (dominio público), que lista los cargos de liderazgo de cada miembro con fechas de inicio y fin. Los títulos se muestran como allí se publican, en inglés. Listas oficiales: ")}
        <a href="https://www.house.gov/leadership">house.gov/leadership</a>, <a href="https://www.senate.gov/senators/leadership.htm">senate.gov</a>.</>} /></h2>
      {!roles ? <p className="notice">{tr("Leadership posts aren't available right now.", "Los cargos de liderazgo no están disponibles en este momento.")}</p> : (
        CHAMBERS.map(([chamber, label]) => {
          const list = roles.filter((r) => r.chamber === chamber);
          const posts = list.filter(isChamberPost);
          const party = list.filter((r) => !isChamberPost(r));
          return (
            <section key={chamber} className="section">
              <h3>{label()}</h3>
              {list.length === 0 ? <p className="fine">{tr("No current posts on record.", "No hay cargos actuales registrados.")}</p> : <>
                <ul className="cards">{posts.map((r) => <LeaderCard key={`${r.bioguide_id}-${r.title}`} role={r} person={people.get(r.bioguide_id)} />)}</ul>
                {party.length > 0 && (
                  <details>
                    <summary>{tr(`Party conference and caucus officers (${party.length})`, `Funcionarios de las conferencias y bancadas de los partidos (${party.length})`)}</summary>
                    <ul className="plain">{party.map((r) => <RoleLine key={`${r.bioguide_id}-${r.title}`} role={r} person={people.get(r.bioguide_id)} />)}</ul>
                  </details>
                )}
              </>}
            </section>
          );
        })
      )}

      <h2 id="speaker-elections">{tr("Speaker elections", "Elecciones del Presidente de la Cámara (Speaker)")}<Ref id="src-speaker" text={<>{tr(
        "Source: House Clerk roll-call records, question “Election of the Speaker”, since 2023. Members vote by calling out a name; positions and the result are shown as the Clerk recorded them. A Speaker is elected by a majority of the votes cast for a person by name; “Present” and “Not Voting” do not count toward it. The majority line is worked out from the recorded counts.",
        "Fuente: registros de votaciones nominales del Secretario de la Cámara, pregunta “Election of the Speaker”, desde 2023. Los miembros votan diciendo un nombre; las posiciones y el resultado se muestran como los registró el Secretario. Se elige Presidente con la mayoría de los votos emitidos por una persona por su nombre; “Present” y “Not Voting” no cuentan. La línea de mayoría se calcula a partir de los conteos registrados.")}</>} /></h2>
      {!elections ? <p className="notice">{tr("Speaker elections aren't available right now.", "Las elecciones del Presidente no están disponibles en este momento.")}</p>
        : elections.length === 0 ? <p className="fine">{tr("No Speaker elections on record.", "No hay elecciones del Presidente registradas.")}</p>
        : elections.map((e, i) => <SpeakerElection key={e.ballots[0].vote_id} election={e} open={i === 0} />)}

      <h2 id="committee-leaders">{committeeCongress
        ? tr(`Committee leaders in the ${ordinal(committeeCongress)} Congress`, `Líderes de comités en el ${ordinal(committeeCongress)} Congreso`)
        : tr("Committee leaders", "Líderes de comités")}<Ref id="src-committees" text={<>{tr(
        "Source: committee rosters from unitedstates/congress-legislators, compiled from the House and Senate committee websites. Full committees only; titles (Chair, Chairman, Ranking Member) as published.",
        "Fuente: listas de comités de unitedstates/congress-legislators, compiladas de los sitios web de los comités de la Cámara y el Senado. Solo comités en pleno; títulos (Chair, Chairman, Ranking Member) tal como se publican.")}</>} /></h2>
      {!committees ? <p className="notice">{tr("Committee leaders aren't available right now.", "Los líderes de comités no están disponibles en este momento.")}</p> : (
        <CommitteeLeaders committees={committees} posts={committeePosts} people={people} />
      )}
      <NotesList />
    </main>
  );
}

function PersonLink({ id, person }) {
  return <><Link to={`/member/${id}`}>{person?.name ?? id}</Link>{person && <> <PartyTag p={person} /></>}</>;
}

function LeaderCard({ role, person }) {
  return (
    <li className="card">
      <p className="seat">{role.title}</p>
      <Portrait className="member-photo small" size="small" party={person?.party} src={photo(role.bioguide_id)} alt={person?.name ?? ""} width="60" height="73" loading="lazy" />
      <h3><PersonLink id={role.bioguide_id} person={person} /></h3>
      <p className="meta">{tr(`Since ${date(role.start_date)}`, `Desde el ${date(role.start_date)}`)}</p>
    </li>
  );
}

function RoleLine({ role, person }) {
  return <li>{role.title}: <PersonLink id={role.bioguide_id} person={person} /> <span className="fine">{tr(`since ${date(role.start_date)}`, `desde el ${date(role.start_date)}`)}</span></li>;
}

function SpeakerElection({ election: e, open }) {
  const first = date(e.first), last = date(e.last);
  const when = first === last ? first : `${first} – ${last}`;
  const n = e.ballots.length;
  const outcome = e.elected
    ? tr(`${e.elected.name} received a majority on ballot ${e.elected.ballot} (${e.elected.tally.candidates[0].votes} of ${e.elected.tally.cast} votes cast for a named candidate).`,
      `${e.elected.name} recibió la mayoría en la votación ${e.elected.ballot} (${e.elected.tally.candidates[0].votes} de ${e.elected.tally.cast} votos emitidos por un candidato con nombre).`)
    : tr("No candidate has received a majority on the ballots recorded so far.", "Ningún candidato ha recibido la mayoría en las votaciones registradas hasta ahora.");
  return (
    <details className="fold" open={open}>
      <summary>
        <h3>{when} · {tr(`${ordinal(e.congress)} Congress`, `${ordinal(e.congress)} Congreso`)} · {tr(`${n} ballot${n === 1 ? "" : "s"}`, `${n} votaci${n === 1 ? "ón" : "ones"}`)}</h3>
        <span className="fold-summary">{outcome}</span>
      </summary>
      <div className="fold-body">
        <ol className="plain">{[...e.ballots].reverse().map((b) => <Ballot key={b.vote_id} b={b} of={n} />)}</ol>
      </div>
    </details>
  );
}

function Ballot({ b, of }) {
  const [show, setShow] = useState(false);
  const { candidates, others, cast, needed, majority } = b.tally;
  return (
    <li className="section">
      <h4>{tr(`Ballot ${b.ballot} of ${of}`, `Votación ${b.ballot} de ${of}`)} · {date(b.voted_at)} · <a href={b.source_url}>{tr(`Roll call ${b.roll_number}`, `Votación nominal ${b.roll_number}`)}</a></h4>
      <table>
        <thead><tr><th>{tr("Name as recorded", "Nombre registrado")}</th><th>{tr("Votes", "Votos")}</th></tr></thead>
        <tbody>
          {candidates.map((c) => <tr key={c.position}><td>{c.position}</td><td>{c.votes}</td></tr>)}
          {others.map((c) => <tr key={c.position} className="fine"><td>{c.position}</td><td>{c.votes}</td></tr>)}
        </tbody>
      </table>
      <p className="fine">
        {cast > 0 && tr(`${cast} votes cast for a named candidate; a majority is ${needed}. `, `${cast} votos emitidos por un candidato con nombre; la mayoría es ${needed}. `)}
        {majority ? tr(`${majority} received a majority.`, `${majority} recibió la mayoría.`) : tr("No candidate received a majority.", "Ningún candidato recibió la mayoría.")}
        {" "}{tr("Result as recorded by the Clerk", "Resultado registrado por el Secretario")}: {b.result}.
      </p>
      <button className="link fine" aria-expanded={show} onClick={() => setShow(!show)}>
        {show ? tr("Hide how each member voted", "Ocultar cómo votó cada miembro") : tr("How each member voted", "Cómo votó cada miembro")}
      </button>
      {show && <VoteBreakdown voteId={b.vote_id} />}
    </li>
  );
}

function CommitteeLeaders({ committees, posts, people }) {
  const byCommittee = new Map();
  for (const p of posts) byCommittee.set(p.committee_id, [...(byCommittee.get(p.committee_id) ?? []), p]);
  const who = (list, test) => list.filter((p) => test(p.title));
  const cell = (list) => list.length ? list.map((p, i) => <span key={p.bioguide_id}>{i ? "; " : ""}<PersonLink id={p.bioguide_id} person={people.get(p.bioguide_id)} /></span>) : "—";
  const groups = [...CHAMBERS, ["joint", () => tr("Joint committees", "Comités conjuntos")]];
  return groups.map(([chamber, label]) => {
    const rows = committees.filter((c) => c.chamber === chamber && byCommittee.has(c.committee_id));
    if (!rows.length) return null;
    return (
      <section key={chamber} className="section">
        <h3>{label()}</h3>
        <table>
          <thead><tr><th>{tr("Committee", "Comité")}</th><th>{tr("Chair", "Presidencia")}</th><th>{tr("Ranking member", "Miembro de mayor rango de la minoría")}</th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const list = byCommittee.get(c.committee_id);
              return (
                <tr key={c.committee_id}>
                  <td><Link to={`/committee/${c.committee_id}`}>{c.name}</Link></td>
                  <td>{cell(who(list, isChair))}</td>
                  <td>{cell(who(list, isRanking))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    );
  });
}
