import { NotesList, Ref } from "../components/Notes.jsx";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, ordinal } from "../lib/format.js";
import { statementFor, meetingHeading } from "../../lib/meetings.js";
import { itemsLabel } from "../lib/meetingLabels.js";
import { meetingTime } from "../components/MeetingList.jsx";
import CommitteeRoster from "../components/CommitteeRoster.jsx";
import { tr } from "../lib/lang.js";

const videoLabel = (url) => /youtube\.com|youtu\.be/.test(url) ? "Video (YouTube)"
  : /senate\.gov\/isvp/.test(url) ? tr("Video (Senate)", "Video (Senado)") : /congress\.gov\/event/.test(url) ? tr("Video and record (Congress.gov)", "Video y registro (Congress.gov)") : "Video";
const TYPE_ES = { "hearing": "audiencia", "open hearing": "audiencia abierta", "closed hearing": "audiencia cerrada", "markup": "sesión de enmiendas",
  "meeting": "reunión", "open business meeting": "reunión de trabajo abierta", "closed business meeting": "reunión de trabajo cerrada", "business meeting": "reunión de trabajo" };

// One committee hearing, markup or business meeting.
export default function Hearing() {
  const { id } = useParams();
  const [state, setState] = useState({ status: "loading" });

  useEffect(() => {
    if (!/^\d{1,9}$/.test(id ?? "")) { setState({ status: "missing" }); return; }
    setState({ status: "loading" });
    (async () => {
      const { data: m, error } = await db.from("committee_meetings").select("*").eq("event_id", id).maybeSingle();
      if (error) throw error;
      if (!m) { setState({ status: "missing" }); return; }
      const refs = m.bill_refs.map((r) => r.split("-")).map(([c, t, n]) => ({ congress: Number(c), bill_type: t, number: Number(n) }));
      const [committees, bills] = await Promise.all([
        m.committee_ids.length ? db.from("committees").select("committee_id,name,chamber,url,parent:parent_id(committee_id,name,url)").in("committee_id", m.committee_ids) : { data: [] },
        refs.length ? db.from("bills").select("congress,bill_type,number,short_title,title")
          .or(refs.map((r) => `and(congress.eq.${r.congress},bill_type.eq.${r.bill_type},number.eq.${r.number})`).join(",")) : { data: [] },
      ]);
      setState({ status: "done", m, committees: committees.data ?? [], refs, bills: bills.data ?? [] });
    })().catch(() => setState({ status: "error" }));
  }, [id]);

  if (state.status === "loading") return <main className="page"><p>{tr("Loading…", "Cargando…")}</p></main>;
  if (state.status === "missing") return <main className="page"><h1>{tr("Meeting not found", "Reunión no encontrada")}</h1><p>{tr("Committee meetings from the 118th Congress (2023) on are covered.", "Se incluyen las reuniones de comités desde el 118.º Congreso (2023).")} <Link to="/committees">{tr("All committees", "Todos los comités")}</Link></p></main>;
  if (state.status === "error") return <main className="page"><p className="notice">{tr("Couldn't load this meeting right now. Try again shortly.", "No se pudo cargar esta reunión. Inténtelo de nuevo en un momento.")}</p></main>;

  const { m, committees, refs, bills } = state;
  const chamberName = m.chamber === "house" ? "House" : "Senate";
  const typeLower = (m.meeting_type ?? "meeting").toLowerCase();
  const billFor = (r) => bills.find((b) => b.congress === r.congress && b.bill_type === r.bill_type && b.number === r.number);
  // Where a Senate committee posts its witnesses: the committee's own site (the parent's for a subcommittee).
  const site = committees.map((c) => c.url ?? c.parent?.url).find(Boolean);
  const isHearing = /hearing/i.test(m.meeting_type ?? "");
  const { heading, agenda } = meetingHeading(m.title, m.meeting_type, itemsLabel);

  return (
    <main className="page">
      <p className="fine">
        {tr(`${chamberName} committee ${typeLower}`, `${TYPE_ES[typeLower] ?? typeLower} de comité del ${m.chamber === "house" ? "la Cámara" : "Senado"}`.replace(/^./, (c) => c.toUpperCase()))} · {ordinal(m.congress)} {tr("Congress", "Congreso")}
      </p>
      <h1>{heading}<Ref id="src" text={<>{tr("Source", "Fuente")}: <a href={m.source_url}>{tr("Congress.gov committee meeting record", "registro de reunión de comité en Congress.gov")}</a>. {tr("Times are Eastern.", "Horas en la zona del Este.")} <Link to="/methods#hearings">{tr("About this data", "Sobre estos datos")}</Link>.</>} /></h1>
      {agenda && <ul className="plain agenda">{agenda.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      <p>
        {meetingTime(m)}{m.location && <> · {m.location}</>}
        {m.status && !/^scheduled$/i.test(m.status) && <> · <strong>{m.status}</strong></>}
      </p>
      {committees.length > 0 && (
        <p>
          {committees.map((c, i) => (
            <span key={c.committee_id}>{i > 0 && " · "}<Link to={`/committee/${c.committee_id}`}>{c.parent ? `${c.parent.name}: ${c.name}` : /^(House|Senate|Joint)\b/.test(c.name) ? c.name : `${chamberName} ${c.name}`}</Link></span>
          ))}
        </p>
      )}

      {m.videos.length > 0 && (
        <section className="section">
          <h2>{tr("Watch", "Ver")}</h2>
          <ul className="plain">{m.videos.map((v) => <li key={v.url}><a href={v.url}>{videoLabel(v.url)}</a></li>)}</ul>
        </section>
      )}

      {(m.witnesses.length > 0 || (m.chamber === "senate" && isHearing)) && (
        <section className="section">
          <h2>{tr("Witnesses", "Testigos")}</h2>
          {m.witnesses.length > 0 ? (
            <ul className="plain">
              {m.witnesses.map((w, i) => {
                const st = statementFor(w, m.statements);
                return (
                  <li key={i}>
                    <strong>{w.name}</strong>{[w.position, w.organization].filter(Boolean).length > 0 && <>, {[w.position, w.organization].filter(Boolean).join(", ")}</>}
                    {st && <> · <a href={st}>{tr("Written statement", "Declaración escrita (en inglés)")}</a></>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>
              {tr("Senate committees post witness lists on their own websites; the central congressional record doesn't include them.", "Los comités del Senado publican las listas de testigos en sus propios sitios web; el registro central del Congreso no las incluye.")}
              {site && <> {tr("See the", "Vea el")} <a href={site}>{tr("committee's website", "sitio web del comité")}</a>.</>}
            </p>
          )}
          {m.witnesses.length > 0 && m.statements.length > 0 && <p className="fine">{tr("Biographies and disclosure forms are on the", "Las biografías y los formularios de divulgación están en la")} <a href={m.source_url}>{tr("Congress.gov page", "página de Congress.gov")}</a>.</p>}
        </section>
      )}

      {(refs.length > 0 || m.nomination_refs.length > 0) && (
        <section className="section">
          <h2>{tr("On the agenda", "En la agenda")}</h2>
          <ul className="plain">
            {refs.map((r) => {
              const b = billFor(r);
              const label = billLabel(r);
              return (
                <li key={`${r.congress}-${r.bill_type}-${r.number}`}>
                  {b ? <Link to={`/bill/${r.congress}/${r.bill_type}/${r.number}`}>{label}</Link> : label}
                  {b && <> · {b.short_title ?? b.title}</>}
                </li>
              );
            })}
            {m.nomination_refs.length > 0 && <li>{tr("Nominations", "Nominaciones")}: {m.nomination_refs.join(", ")} (<Link to={`/nominations?congress=${m.congress}`}>{tr("Senate votes on nominations", "Votaciones del Senado sobre nominaciones")}</Link>)</li>}
          </ul>
        </section>
      )}

      {/* The subcommittee's roster for a subcommittee meeting, otherwise the full committee's. */}
      <CommitteeRoster committeeIds={[...m.committee_ids.filter((c) => c.length > 4), ...m.committee_ids.filter((c) => c.length === 4)]} congress={m.congress} />

      {m.documents.length > 0 && (
        <section className="section">
          <h2>{tr("Documents", "Documentos")}</h2>
          <ul className="plain">
            {m.documents.map((d, i) => (
              <li key={i}>{d.url ? <a href={d.url}>{d.name ?? d.type ?? "Document"}</a> : (d.name ?? d.type)}{d.type && d.name && d.type !== d.name && <span className="fine"> · {d.type}</span>}</li>
            ))}
          </ul>
        </section>
      )}

      {m.has_transcript && <p>{tr("A printed transcript has been published; it's linked from the", "Se publicó una transcripción impresa; está enlazada desde la")} <a href={m.source_url}>{tr("Congress.gov page", "página de Congress.gov")}</a>.</p>}

      <NotesList />
    </main>
  );
}
