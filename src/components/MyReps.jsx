import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, date } from "../lib/format.js";
import { isFinal } from "../lib/voteKind.js";
import { useLang } from "../lib/i18n.jsx";
import { forgetRepresentatives } from "../lib/myReps.js";
import { forgetDistricts, savedDistricts } from "../lib/savedDistricts.js";
import { KindLabel, Position } from "./Explain.jsx";
import { PartyTag } from "./PartyTag.jsx";

// The home page for a returning visitor: what each of their members of Congress did in the last
// seven days (roll calls cast or missed, with what each recorded vote meant; bills introduced;
// committee meetings), or their latest vote when Congress hasn't voted that week.
const DAY = 86400000;
const isMine = (m, mine) => (m.committee_ids ?? []).some((c) => mine.has(c) || mine.has(c.slice(0, 4)));

export default function MyReps({ ids, onForget }) {
  // Clears the remembered officials and districts and returns the home page to a blank start,
  // with the cursor in the address box.
  const forget = () => {
    forgetRepresentatives(); forgetDistricts(); onForget();
    requestAnimationFrame(() => { window.scrollTo({ top: 0 }); document.getElementById("address")?.focus(); });
  };
  const [rows, setRows] = useState(null);
  const { t } = useLang();

  useEffect(() => {
    const list = [...ids];
    const now = Date.now();
    const weekAgo = new Date(now - 7 * DAY).toISOString();
    const VOTE_COLS = "bioguide_id,chamber,position,question,description,document_name,voted_at,bill_congress,bill_type,bill_number,bill_title";
    Promise.all([
      db.from("member_directory").select("bioguide_id,name,chamber,state,district,party,serving").in("bioguide_id", list),
      db.from("member_votes").select(VOTE_COLS).in("bioguide_id", list).gte("voted_at", weekAgo).order("voted_at", { ascending: false }).limit(500),
      ...list.map((id) => db.from("member_votes").select(VOTE_COLS).eq("bioguide_id", id).order("voted_at", { ascending: false }).limit(1)),
      db.from("committee_memberships").select("bioguide_id,committee_id,congress").in("bioguide_id", list),
      db.from("bill_list").select("congress,bill_type,number,title,short_title,introduced_date,sponsor_bioguide_id").in("sponsor_bioguide_id", list).gte("introduced_date", weekAgo.slice(0, 10)).order("introduced_date", { ascending: false }).limit(50),
    ]).then(async (res) => {
      const people = res[0].data ?? [];
      const week = res[1].data ?? [];
      const latest = Object.fromEntries(res.slice(2, 2 + list.length).map((r) => [r.data?.[0]?.bioguide_id, r.data?.[0]]));
      const cm = res[2 + list.length].data ?? [];
      const bills = res[3 + list.length].data ?? [];
      const top = Math.max(0, ...cm.map((c) => c.congress));
      const committeesOf = (id) => new Set(cm.filter((c) => c.congress === top && c.bioguide_id === id).map((c) => c.committee_id));
      const all = [...new Set(cm.filter((c) => c.congress === top).map((c) => c.committee_id))];
      // All committee meetings in the two-week window (a few dozen); matched to each member's
      // committees here, so subcommittee meetings count for members of the full committee.
      const { data: pool = [] } = all.length
        ? await db.from("committee_meetings").select("event_id,committee_ids,meeting_at")
          .gte("meeting_at", weekAgo).lte("meeting_at", new Date(now + 7 * DAY).toISOString()).limit(1000)
        : { data: [] };
      const nowIso = new Date(now).toISOString();
      const summary = Object.fromEntries(list.map((id) => {
        const mine = committeesOf(id);
        const theirs = (pool ?? []).filter((m) => isMine(m, mine));
        const votes = week.filter((v) => v.bioguide_id === id);
        return [id, {
          votes,
          missed: votes.filter((v) => /^Not Voting$/i.test(v.position)).length,
          bills: bills.filter((b) => b.sponsor_bioguide_id === id),
          heldMeetings: theirs.filter((m) => m.meeting_at <= nowIso).length,
          nextMeetings: theirs.filter((m) => m.meeting_at > nowIso).length,
        }];
      }));
      const order = { senate: 0, house: 1 };
      setRows({ people: people.sort((a, z) => order[a.chamber] - order[z.chamber]), latest, summary });
    }).catch(() => setRows({ people: [], latest: {}, summary: {} }));
  }, [ids]);

  if (!rows) return <p>{t("Loading your representatives…", "Cargando sus representantes…")}</p>;
  if (rows.people.length === 0) return null;
  return (
    <section className="my-reps">
      <div className="my-reps-head">
        <h2>{t("Your representatives", "Sus representantes")}</h2>
        <button type="button" className="button-secondary small" onClick={forget}>{t("Start over", "Empezar de nuevo")}</button>
      </div>
      <p className="fine">{t("From your last address lookup on this device. In the last 7 days:", "De su última búsqueda de dirección en este dispositivo. En los últimos 7 días:")}</p>
      <ul className="bare my-reps-list">
        {rows.people.map((p) => {
          const w = rows.summary[p.bioguide_id] ?? { votes: [], bills: [], missed: 0, heldMeetings: 0, nextMeetings: 0 };
          const key = w.votes.filter((v) => isFinal(v) && !/^Not Voting$/i.test(v.position)).slice(0, 2);
          const v = rows.latest[p.bioguide_id];
          const billLink = (b) => <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link>;
          return (
            <li key={p.bioguide_id}>
              <Link to={`/member/${p.bioguide_id}`} className="my-rep-name">{p.name}</Link> <PartyTag p={p} /> <span className="fine">{p.chamber === "senate" ? t("Senator", "Senado") : t("Representative", "Cámara")}</span>
              <ul className="plain week-facts">
                {w.votes.length > 0 ? (
                  <li>
                    {t(`Voted on ${w.votes.length - w.missed} of ${w.votes.length} roll calls`, `Votó en ${w.votes.length - w.missed} de ${w.votes.length} votaciones nominales`)}
                    {key.map((x) => (
                      <div key={`${x.voted_at}${x.question}`} className="fine">
                        <Position v={x} position={x.position} /> · {x.bill_type
                          ? <><Link to={`/bill/${x.bill_congress}/${x.bill_type}/${x.bill_number}`}>{billLabel({ bill_type: x.bill_type, number: x.bill_number })}</Link>{x.bill_title && <> {x.bill_title}</>}</>
                          : x.description ?? x.question}
                      </div>
                    ))}
                    <div className="fine"><Link to={`/member/${p.bioguide_id}/votes`}>{t("All their votes", "Todos sus votos")}</Link></div>
                  </li>
                ) : (
                  <li>
                    {t("No roll-call votes this week.", "No hubo votaciones nominales esta semana.")}
                    {v && (
                      <div className="fine">
                        {t("Latest vote", "Último voto")}, {date(v.voted_at)}: <Position v={v} position={v.position} /> · <KindLabel v={v} />{" "}
                        {v.bill_type
                          ? <Link to={`/bill/${v.bill_congress}/${v.bill_type}/${v.bill_number}`}>{v.bill_title ?? v.question}</Link>
                          : v.description ?? v.question}
                      </div>
                    )}
                  </li>
                )}
                {w.bills.length > 0 && (
                  <li>
                    {t(`Introduced ${w.bills.length} bill${w.bills.length === 1 ? "" : "s"} or resolution${w.bills.length === 1 ? "" : "s"}`, `Presentó ${w.bills.length} proyecto${w.bills.length === 1 ? "" : "s"} o resolución${w.bills.length === 1 ? "" : "es"}`)}
                    {w.bills.slice(0, 2).map((b) => <div key={b.number} className="fine">{billLink(b)} {b.short_title ?? b.title}</div>)}
                  </li>
                )}
                {(w.heldMeetings > 0 || w.nextMeetings > 0) && (
                  <li>
                    {t(`Their committees: ${w.heldMeetings} meeting${w.heldMeetings === 1 ? "" : "s"} held, ${w.nextMeetings} coming up`, `Sus comités: ${w.heldMeetings} reunión${w.heldMeetings === 1 ? "" : "es"} realizada${w.heldMeetings === 1 ? "" : "s"}, ${w.nextMeetings} próxima${w.nextMeetings === 1 ? "" : "s"}`)}
                    {" · "}<Link to="/week#committees">{t("Calendar", "Calendario")}</Link>
                  </li>
                )}
              </ul>
            </li>
          );
        })}
      </ul>
      {savedDistricts() && (
        <p><Link to={`/officials?${savedDistricts()}`} className="my-rep-name">{t("All your officials: federal, state and local", "Todos sus funcionarios: federales, estatales y locales")}</Link></p>
      )}
      <p>
        <Link to="/week">{t("This week in Congress", "Esta semana en el Congreso")}</Link>
        {" · "}<Link to="/quiz">{t("Do you vote like them?", "¿Vota como ellos?")}</Link>
      </p>
      <p className="fine">
        {t("Remembered on this device from your last lookup (officials and district numbers only, never your address).", "Guardado en este dispositivo desde su última búsqueda (solo funcionarios y números de distrito, nunca su dirección).")}{" "}
        <button type="button" className="link fine" onClick={forget}>{t("Forget them", "Olvidarlos")}</button>
      </p>
    </section>
  );
}
