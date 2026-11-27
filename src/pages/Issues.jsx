import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { NotesList, Ref } from "../components/Notes.jsx";
import { KindLabel, VoteMeaning } from "../components/Explain.jsx";
import { PartyName } from "../components/PartyTag.jsx";
import Clamp from "../components/Clamp.jsx";
import { db } from "../lib/db.js";
import { billLabel, date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { useLang } from "../lib/i18n.jsx";
import { areaName, topicSlug } from "../lib/policyAreas.js";
import { myRepresentatives } from "../lib/myReps.js";
import { ISSUES, MORE_TOPICS, MAX_PICKS, issueById, togglePick, readPicks, savePicks, windowStart,
  movedFilter, summaryLine, WINDOW_DAYS } from "../lib/issues.js";
import { billTrack, trackShort } from "../../lib/billTrack.js";
import { congressOn } from "../../lib/congress.js";

const STAGE = "congress,bill_type,number,title,short_title,policy_area,introduced_date,reported_date,passed_house_date,failed_house_date,passed_senate_date,failed_senate_date,presented_date,vetoed_date,became_law_date,law_number,latest_action_date";
const LIST = 5;

// "Issues you care about": a visitor picks up to three everyday issues and sees, for each, a one-line
// count of the last 30 days from the official records, a few recent bills and roll calls, and how
// their own members of Congress voted when a lookup is remembered on this device. The same template
// for every issue, member and party; no ranking or scores. Everything else is on the topic pages.
export default function Issues() {
  useLang(); // re-render on language change
  const [picks, setPicks] = useState(() => readPicks());
  const [mine] = useState(() => myRepresentatives());
  const pick = (id) => setPicks((p) => { const next = togglePick(p, id); savePicks(next); return next; });
  const full = picks.length >= MAX_PICKS;

  return (
    <main className="page">
      <h1>{tr("Issues you care about", "Los temas que le importan")}<Ref id="src" text={tr("Sources: GovInfo Bill Status (Library of Congress) for bills and their policy areas; House Clerk and Senate.gov for roll-call votes.", "Fuentes: GovInfo Bill Status (Biblioteca del Congreso) para los proyectos y sus áreas de política; Secretario de la Cámara y Senate.gov para las votaciones nominales.")} /></h1>
      <p className="lede">{tr(`Pick up to ${MAX_PICKS}. You'll see what Congress did on each in the last ${WINDOW_DAYS} days, and how your members of Congress voted.`,
        `Elija hasta ${MAX_PICKS}. Verá lo que hizo el Congreso sobre cada uno en los últimos ${WINDOW_DAYS} días y cómo votaron sus miembros del Congreso.`)}</p>

      <div className="issue-chips" role="group" aria-label={tr("Issues", "Temas")}>
        {ISSUES.map((i) => {
          const on = picks.includes(i.id);
          return (
            <button key={i.id} type="button" className="issue-chip" aria-pressed={on} aria-disabled={!on && full ? true : undefined} onClick={() => pick(i.id)}>
              {tr(i.en, i.es)}
            </button>
          );
        })}
      </div>
      <p className="fine" aria-live="polite">
        {full ? tr(`You've picked ${MAX_PICKS}. Tap one to remove it before adding another.`, `Ya eligió ${MAX_PICKS}. Toque uno para quitarlo antes de agregar otro.`)
          : tr("Saved on this device only.", "Se guarda solo en este dispositivo.")}
      </p>
      <details className="more-topics">
        <summary>{tr("More topics (official names)", "Más temas (nombres oficiales)")}</summary>
        <ul className="bare more-topics-list">
          {MORE_TOPICS.map((a) => <li key={a}><Link to={`/topic/${topicSlug(a)}`}>{areaName(a)}</Link></li>)}
        </ul>
      </details>

      {picks.length > 0 && mine.size === 0 && (
        <p className="notice">{tr("To see how your own members of Congress voted, ", "Para ver cómo votaron sus propios miembros del Congreso, ")}<Link to="/">{tr("look up your address", "busque su dirección")}</Link>{tr(" on the home page. Only member IDs are kept on this device, never the address.", " en la página principal. Solo se guardan en este dispositivo los identificadores de los miembros, nunca la dirección.")}</p>
      )}

      {picks.map((id) => <IssueSection key={id} issue={issueById(id)} mine={mine} />)}

      <p className="fine"><Link to="/methods#issues">{tr("How issues are matched to official topics", "Cómo se relacionan los temas con las áreas oficiales")}</Link></p>
      <NotesList />
    </main>
  );
}

function IssueSection({ issue, mine }) {
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    const since = windowStart();
    // The window can reach back into the previous Congress in early January.
    const congresses = [...new Set([congressOn(new Date(`${since}T12:00:00Z`)), congressOn()])];
    const bills = (cols, opts) => db.from("bills").select(cols, opts).in("congress", congresses).in("policy_area", issue.areas);
    let live = true;
    (async () => {
      const [moved, laws, votes] = await Promise.all([
        bills(STAGE, { count: "exact" }).gte("latest_action_date", since).or(movedFilter(since))
          .order("latest_action_date", { ascending: false }).limit(LIST),
        bills("number", { count: "exact", head: true }).gte("became_law_date", since),
        db.from("vote_list").select("*", { count: "exact" }).in("congress", congresses).in("policy_area", issue.areas)
          .gte("voted_at", since).order("voted_at", { ascending: false }).limit(LIST),
      ]);
      if ([moved, laws, votes].some((r) => r.error)) { if (live) setState({ status: "error" }); return; }
      const ids = (votes.data ?? []).map((v) => v.vote_id);
      // The vote sentence also reads the required majority and any amendment from the roll call.
      const [extra, positions] = ids.length ? await Promise.all([
        db.from("votes").select("vote_id,required,amendment_ref,document_name").in("vote_id", ids),
        mine.size ? db.from("vote_position_details").select("vote_id,bioguide_id,name,last_name,position,party_at_vote").in("vote_id", ids).in("bioguide_id", [...mine])
          : Promise.resolve({ data: [] }),
      ]) : [{ data: [] }, { data: [] }];
      const more = new Map((extra.data ?? []).map((r) => [r.vote_id, r]));
      const byVote = new Map();
      for (const p of positions.data ?? []) byVote.set(p.vote_id, [...(byVote.get(p.vote_id) ?? []), p]);
      for (const list of byVote.values()) list.sort((a, b) => String(a.last_name).localeCompare(String(b.last_name)));
      if (live) setState({
        status: "done",
        // A count the server didn't send falls back to what was listed, so the line never contradicts the list.
        counts: { bills: moved.count ?? moved.data?.length ?? 0, votes: votes.count ?? votes.data?.length ?? 0, laws: laws.count ?? 0 },
        bills: moved.data ?? [],
        votes: (votes.data ?? []).map((v) => ({ ...v, ...more.get(v.vote_id), mine: byVote.get(v.vote_id) ?? [] })),
        positionsFailed: Boolean(positions.error),
      });
    })().catch(() => { if (live) setState({ status: "error" }); });
    return () => { live = false; };
  }, [issue.id]);

  const billLink = (b) => <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link>;
  const line = state.status === "done" ? summaryLine(state.counts) : null;

  return (
    <section className="section issue-section">
      <h2>{tr(issue.en, issue.es)}</h2>
      <p className="fine">{tr("Official topic: ", "Tema oficial: ")}{issue.areas.map((a, i) => <span key={a}>{i > 0 && ", "}{areaName(a)}</span>)}</p>
      {state.status === "loading" && <p>{tr("Loading…", "Cargando…")}</p>}
      {state.status === "error" && <p className="notice">{tr("Couldn't load this issue right now.", "No se pudo cargar este tema en este momento.")}</p>}
      {state.status === "done" && (
        <>
          <p className="issue-line"><strong>{tr(line.en, line.es)}</strong><Ref id="moved" text={tr('A bill "moved" if it reached a step in the record during these days: reported by a committee, a vote in the House or Senate (passed or failed), sent to the President, signed into law or vetoed. Being introduced isn\'t counted. Roll-call votes are recorded votes on bills in this topic, including amendments and procedural motions.', 'Un proyecto "avanzó" si llegó a un paso del registro en estos días: informado por un comité, una votación en la Cámara o el Senado (aprobado o rechazado), enviado al Presidente, firmado como ley o vetado. Su presentación no cuenta. Las votaciones nominales son votos registrados sobre proyectos de este tema, incluidas enmiendas y mociones de procedimiento.')} /></p>

          {state.bills.length > 0 && (
            <>
              <h3>{tr("Bills that moved", "Proyectos que avanzaron")}</h3>
              <ul className="bare issue-list">
                {state.bills.map((b) => {
                  const s = trackShort(billTrack(b), date);
                  return (
                    <li key={`${b.congress}-${b.bill_type}-${b.number}`}>
                      <span className="item-head">{billLink(b)}</span>
                      <Clamp lines={2}>{b.short_title ?? b.title}</Clamp>
                      <div className="fine stage-line">{tr(s.en, s.es)}</div>
                    </li>
                  );
                })}
              </ul>
              {state.counts.bills > state.bills.length && <p className="fine">{tr(`Showing ${state.bills.length} of ${state.counts.bills}, most recent action first.`, `Se muestran ${state.bills.length} de ${state.counts.bills}, por acción más reciente.`)}</p>}
            </>
          )}

          {state.votes.length > 0 && (
            <>
              <h3>{tr("Roll-call votes", "Votaciones nominales")}</h3>
              <ul className="bare issue-list">
                {state.votes.map((v) => (
                  <li key={v.vote_id}>
                    <div className="fine">{date(v.voted_at)} · {v.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")}</div>
                    <VoteMeaning v={v} />
                    <div className="fine"><KindLabel v={v} /> <a href={v.source_url}>{v.question}</a>: {v.result}{v.yea_total != null && ` (${v.yea_total}–${v.nay_total})`}</div>
                    <div className="fine">{billLink({ congress: v.bill_congress, bill_type: v.bill_type, number: v.bill_number })} {v.bill_title}</div>
                    {v.mine.length > 0 && (
                      <ul className="bare my-votes" aria-label={tr("How your members voted", "Cómo votaron sus miembros")}>
                        {v.mine.map((p) => (
                          <li key={p.bioguide_id}>
                            <Link to={`/member/${p.bioguide_id}`}>{p.name}</Link> <PartyName party={p.party_at_vote} /> · {tr("voted ", "votó ")}<strong>{p.position}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              {state.counts.votes > state.votes.length && <p className="fine">{tr(`Showing the ${state.votes.length} most recent of ${state.counts.votes}.`, `Se muestran las ${state.votes.length} más recientes de ${state.counts.votes}.`)}</p>}
              {state.positionsFailed && <p className="fine">{tr("Your members' votes couldn't be loaded right now.", "No se pudieron cargar ahora los votos de sus miembros.")}</p>}
            </>
          )}
        </>
      )}
      <p className="issue-more">
        {issue.areas.map((a) => (
          <Link key={a} to={`/topic/${topicSlug(a)}`}>{issue.areas.length > 1 ? tr(`See everything on ${areaName(a)} →`, `Ver todo sobre ${areaName(a)} →`) : tr("See everything on this topic →", "Ver todo sobre este tema →")}</Link>
        ))}
      </p>
    </section>
  );
}
