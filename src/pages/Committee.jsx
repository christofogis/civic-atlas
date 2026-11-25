import { NotesList, Ref } from "../components/Notes.jsx";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import MeetingList from "../components/MeetingList.jsx";
import Follow from "../components/Follow.jsx";
import { congressOn, congressYears } from "../../lib/congress.js";
import { billLabel, ordinal, partyTag, date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { PartyTag } from "../components/PartyTag.jsx";
import Clamp from "../components/Clamp.jsx";

const PAGE = 50;
const CURRENT = congressOn();
// Coverage starts with the 118th Congress.
const CONGRESS_OPTIONS = Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i);
const SORTS = {
  action: { label: "Most recent action", es: "Acción más reciente", column: "latest_action_date" },
  referred: { label: "Most recently referred", es: "Remitidos más recientemente", column: "first_activity_date" },
  lobbying: { label: "Most organizations lobbying", es: "Más organizaciones haciendo cabildeo", column: "lobbying_clients" },
};

export default function Committee() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const congress = Number(params.get("congress")) || CURRENT;
  const sort = SORTS[params.get("sort")] ? params.get("sort") : "action";
  const [info, setInfo] = useState({ status: "loading" });
  const [bills, setBills] = useState({ status: "loading", rows: [] });
  const [shown, setShown] = useState(PAGE);
  const set = (k, v) => { const n = new URLSearchParams(params); n.set(k, v); setParams(n, { replace: true }); setShown(PAGE); };

  useEffect(() => {
    if (!/^[A-Z]{4}\d{0,2}$/.test(id ?? "")) { setInfo({ status: "missing" }); return; }
    (async () => {
      const [c, subs, mem, events] = await Promise.all([
        db.from("committees").select("committee_id,name,chamber,url,parent:parent_id(committee_id,name)").eq("committee_id", id).maybeSingle(),
        db.from("committees").select("committee_id,name").eq("parent_id", id).order("name"),
        db.from("committee_memberships").select("bioguide_id,side,rank,title,congress").eq("committee_id", id)
          .order("congress", { ascending: false }).order("side").order("rank"),
        db.from("upcoming_events").select("event_id,kind,event_date,event_time,committee_id,committee_name,title,status,source_url")
          .like("committee_id", `${id}%`).gte("event_date", new Date().toISOString().slice(0, 10)).order("event_date").limit(50),
      ]);
      if (c.error || !c.data) { setInfo({ status: c.error ? "error" : "missing" }); return; }
      const latest = mem.data?.[0]?.congress;
      const roster = (mem.data ?? []).filter((m) => m.congress === latest);
      const { data: people } = roster.length
        ? await db.from("member_directory").select("bioguide_id,name,party,chamber,state,district").in("bioguide_id", roster.map((r) => r.bioguide_id))
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.bioguide_id, p]));
      // Recent hearings and meetings of this committee and its subcommittees.
      const ids = [id, ...(subs.data ?? []).map((x) => x.committee_id)];
      const { data: meetings } = await db.from("committee_meetings").select("event_id,meeting_at,title,meeting_type,status,committee_ids")
        .overlaps("committee_ids", ids).lte("meeting_at", new Date(Date.now() + 864e5).toISOString())
        .order("meeting_at", { ascending: false }).limit(25);
      setInfo({ status: "done", committee: c.data, subs: subs.data ?? [], rosterCongress: latest, events: events.data ?? [], meetings: meetings ?? [],
        roster: roster.map((r) => ({ ...r, person: byId.get(r.bioguide_id) })) });
    })().catch(() => setInfo({ status: "error" }));
  }, [id]);

  useEffect(() => {
    setBills((b) => ({ ...b, status: "loading" }));
    db.from("committee_bills")
      .select("congress,bill_type,number,title,short_title,latest_action_date,latest_action_text,first_activity_date,sponsor_bioguide_id,sponsor_name,lobbying_clients", { count: "exact" })
      .eq("committee_id", id).eq("congress", congress)
      .order(SORTS[sort].column, { ascending: false, nullsFirst: false }).order("number").limit(1000)
      .then(({ data, error, count }) => setBills(error ? { status: "error", rows: [] } : { status: "done", rows: data, count }));
  }, [id, congress, sort]);

  if (info.status === "missing") return <main className="page"><h1>{tr("Committee not found", "Comité no encontrado")}</h1><p><Link to="/committees">{tr("All committees", "Todos los comités")}</Link></p></main>;
  if (info.status === "error") return <main className="page"><p className="notice">{tr("Couldn't load this committee right now.", "No se pudo cargar este comité en este momento.")}</p></main>;
  if (info.status === "loading") return <main className="page"><p>{tr("Loading…", "Cargando…")}</p></main>;
  const { committee: c, subs, roster, rosterCongress, events, meetings } = info;
  const subNames = Object.fromEntries(subs.map((x) => [x.committee_id, x.name]));
  const sides = ["majority", "minority"].map((s) => [s, roster.filter((r) => r.side === s)]).filter(([, l]) => l.length);
  const chamberName = { house: tr("House", "Cámara:"), senate: tr("Senate", "Senado:"), joint: tr("Joint", "Conjunto:") }[c.chamber] ?? c.chamber;

  return (
    <main className="page wide">
      <p className="fine"><Link to="/committees">{tr("Committees", "Comités")}</Link>{c.parent && <> · <Link to={`/committee/${c.parent.committee_id}`}>{c.parent.name}</Link></>}</p>
      <h1>{c.chamber === "joint" ? c.name : `${chamberName} ${c.name}`}</h1>
      {c.url && <p className="fine"><a href={c.url}>{tr("Committee website", "Sitio web del comité (en inglés)")}</a></p>}
      <Follow calendar={`/api/calendar/committee/${c.committee_id}`} />

      {events.length > 0 && (
        <section className="section">
          <h2>{tr("Coming up", "Próximamente")}</h2>
          <ul className="plain">
            {events.map((e) => (
              <li key={e.event_id}>
                <strong>{date(e.event_date)}</strong>{e.event_time && <> {e.event_time} {tr("ET", "(hora del Este)")}</>} · {e.kind === "markup" ? tr("Markup", "Sesión de enmiendas") : e.kind === "hearing" ? tr("Hearing", "Audiencia") : tr("Meeting", "Reunión")}
                {e.committee_id !== c.committee_id && <> · {e.committee_name}</>}: <a href={e.source_url}>{e.title}</a>
                {e.status && e.status !== "Scheduled" && <strong> ({e.status})</strong>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {meetings.length > 0 && (
        <section className="section">
          <h2>{tr("Recent hearings and meetings", "Audiencias y reuniones recientes")}<Ref id="src-meetings" text={<>{tr("Source: Congress.gov committee meeting records. The 25 most recent are listed; each links to video, documents and, for House hearings, witnesses.", "Fuente: registros de reuniones de comités de Congress.gov. Se listan las 25 más recientes; cada una enlaza a video, documentos y, en audiencias de la Cámara, testigos.")}</>} /></h2>
          <MeetingList meetings={meetings} showCommittee committees={{ [c.committee_id]: tr("Full committee", "Comité en pleno"), ...subNames }} />
        </section>
      )}

      {subs.length > 0 && (
        <section className="section">
          <h2>{tr("Subcommittees", "Subcomités")}</h2>
          <ul className="plain columns">{subs.map((s) => <li key={s.committee_id}><Link to={`/committee/${s.committee_id}`}>{s.name}</Link></li>)}</ul>
        </section>
      )}

      <section className="section">
        <h2>{tr("Members", "Miembros")}{rosterCongress && tr(` (${ordinal(rosterCongress)} Congress)`, ` (${ordinal(rosterCongress)} Congreso)`)}<Ref id="src-members" text={<>{tr("Source: unitedstates/congress-legislators. Listed in committee rank order.", "Fuente: unitedstates/congress-legislators. En el orden de rango del comité.")}</>} /></h2>
        {sides.length === 0 ? <p>{tr("No membership on record.", "No hay miembros registrados.")}</p> : sides.map(([side, list]) => (
          <div key={side}>
            <h3 className="small">{side === "majority" ? tr("Majority", "Mayoría") : tr("Minority", "Minoría")}</h3>
            <ul className="plain columns">
              {list.map((r) => (
                <li key={r.bioguide_id}>
                  <Link to={`/member/${r.bioguide_id}`}>{r.person?.name ?? r.bioguide_id}</Link>
                  {r.person && <> <PartyTag p={r.person} /></>}{r.title && <span className="fine"> · {r.title}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="section">
        <h2>{tr("Bills referred", "Proyectos remitidos")}<Ref id="src-bills" text={<>{tr("Source: GovInfo Bill Status (Library of Congress). Includes bills referred to this committee or later handled by it.", "Fuente: GovInfo Bill Status (Biblioteca del Congreso). Incluye proyectos remitidos a este comité o que este tramitó después.")}</>} /></h2>
        <div className="filters">
          <label>{tr("Congress", "Congreso")}{" "}
            <select value={congress} onChange={(e) => set("congress", e.target.value)}>
              {CONGRESS_OPTIONS.map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
            </select>
          </label>
          <label>{tr("Sort", "Ordenar")}{" "}
            <select value={sort} onChange={(e) => set("sort", e.target.value)}>
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{tr(s.label, s.es)}</option>)}
            </select>
          </label>
        </div>
        {bills.status === "error" && <p className="notice">{tr("Couldn't load bills.", "No se pudieron cargar los proyectos.")}</p>}
        {bills.status === "done" && <p>{tr(`${(bills.count ?? bills.rows.length).toLocaleString()} bills referred in the ${ordinal(congress)} Congress.`, `${(bills.count ?? bills.rows.length).toLocaleString()} proyectos remitidos en el ${ordinal(congress)} Congreso.`)}</p>}
        {bills.rows.length > 0 && (
          <table className={bills.status === "loading" ? "dim" : ""}>
            <thead><tr><th>{tr("Bill", "Proyecto")}</th><th>{tr("Referred", "Remitido")}</th><th>{tr("Latest action", "Última acción")}</th>{sort === "lobbying" && <th>{tr("Lobbying", "Cabildeo")}</th>}</tr></thead>
            <tbody>
              {bills.rows.slice(0, shown).map((b) => (
                <tr key={`${b.bill_type}-${b.number}`}>
                  <td><Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link> <Clamp lines={2}>{b.short_title ?? b.title}</Clamp>
                    {b.sponsor_name && <div className="fine">{tr("Sponsor", "Patrocinador")}: <Link to={`/member/${b.sponsor_bioguide_id}`}>{b.sponsor_name}</Link></div>}</td>
                  <td className="fine">{date(b.first_activity_date)}</td>
                  <td><span className="fine">{date(b.latest_action_date)}</span><div>{b.latest_action_text}</div></td>
                  {sort === "lobbying" && <td>{b.lobbying_clients.toLocaleString()}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {bills.rows.length > shown && <p><button className="link" onClick={() => setShown(shown + PAGE)}>{tr("Show more", "Mostrar más")}</button></p>}
        {bills.count > bills.rows.length && <p className="fine">{tr("Showing the first 1,000.", "Se muestran los primeros 1,000.")}</p>}
      </section>
      <NotesList />
    </main>
  );
}
