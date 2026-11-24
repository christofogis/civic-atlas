import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, ordinal } from "../lib/format.js";
import { statementFor, meetingHeading } from "../../lib/meetings.js";
import { meetingTime } from "../components/MeetingList.jsx";

const videoLabel = (url) => /youtube\.com|youtu\.be/.test(url) ? "Video (YouTube)"
  : /senate\.gov\/isvp/.test(url) ? "Video (Senate)" : /congress\.gov\/event/.test(url) ? "Video and record (Congress.gov)" : "Video";

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

  if (state.status === "loading") return <main className="page"><p>Loading…</p></main>;
  if (state.status === "missing") return <main className="page"><h1>Meeting not found</h1><p>Committee meetings from the 118th Congress (2023) on are covered. <Link to="/committees">Committees</Link></p></main>;
  if (state.status === "error") return <main className="page"><p className="notice">Couldn't load this meeting right now. Try again shortly.</p></main>;

  const { m, committees, refs, bills } = state;
  const chamberName = m.chamber === "house" ? "House" : "Senate";
  const billFor = (r) => bills.find((b) => b.congress === r.congress && b.bill_type === r.bill_type && b.number === r.number);
  // Where a Senate committee posts its witnesses: the committee's own site (the parent's for a subcommittee).
  const site = committees.map((c) => c.url ?? c.parent?.url).find(Boolean);
  const isHearing = /hearing/i.test(m.meeting_type ?? "");
  const { heading, agenda } = meetingHeading(m.title, m.meeting_type);

  return (
    <main className="page">
      <p className="fine">
        {chamberName} committee {(m.meeting_type ?? "meeting").toLowerCase()} · {ordinal(m.congress)} Congress
      </p>
      <h1>{heading}</h1>
      {agenda && <ul className="plain agenda">{agenda.map((l, i) => <li key={i}>{l}</li>)}</ul>}
      <p>
        {meetingTime(m)}{m.location && <> · {m.location}</>}
        {m.status && !/^scheduled$/i.test(m.status) && <> · <strong>{m.status}</strong></>}
      </p>
      {committees.length > 0 && (
        <p>
          {committees.map((c, i) => (
            <span key={c.committee_id}>{i > 0 && " · "}<Link to={`/committee/${c.committee_id}`}>{c.parent ? `${c.parent.name}: ${c.name}` : `${chamberName} ${c.name}`}</Link></span>
          ))}
        </p>
      )}

      {m.videos.length > 0 && (
        <section className="section">
          <h2>Watch</h2>
          <ul className="plain">{m.videos.map((v) => <li key={v.url}><a href={v.url}>{videoLabel(v.url)}</a></li>)}</ul>
        </section>
      )}

      {(m.witnesses.length > 0 || (m.chamber === "senate" && isHearing)) && (
        <section className="section">
          <h2>Witnesses</h2>
          {m.witnesses.length > 0 ? (
            <ul className="plain">
              {m.witnesses.map((w, i) => {
                const st = statementFor(w, m.statements);
                return (
                  <li key={i}>
                    <strong>{w.name}</strong>{[w.position, w.organization].filter(Boolean).length > 0 && <>, {[w.position, w.organization].filter(Boolean).join(", ")}</>}
                    {st && <> · <a href={st}>Written statement</a></>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>
              Senate committees post witness lists on their own websites; the central congressional record doesn't
              include them.{site && <> See the <a href={site}>committee's website</a>.</>}
            </p>
          )}
          {m.witnesses.length > 0 && m.statements.length > 0 && <p className="fine">Biographies and disclosure forms are on the <a href={m.source_url}>Congress.gov page</a>.</p>}
        </section>
      )}

      {(refs.length > 0 || m.nomination_refs.length > 0) && (
        <section className="section">
          <h2>On the agenda</h2>
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
            {m.nomination_refs.length > 0 && <li>Nominations: {m.nomination_refs.join(", ")} (<Link to={`/nominations?congress=${m.congress}`}>Senate votes on nominations</Link>)</li>}
          </ul>
        </section>
      )}

      {m.documents.length > 0 && (
        <section className="section">
          <h2>Documents</h2>
          <ul className="plain">
            {m.documents.map((d, i) => (
              <li key={i}>{d.url ? <a href={d.url}>{d.name ?? d.type ?? "Document"}</a> : (d.name ?? d.type)}{d.type && d.name && d.type !== d.name && <span className="fine"> · {d.type}</span>}</li>
            ))}
          </ul>
        </section>
      )}

      {m.has_transcript && <p>A printed transcript has been published; it's linked from the <a href={m.source_url}>Congress.gov page</a>.</p>}

      <p className="fine">Source: <a href={m.source_url}>Congress.gov committee meeting record</a>. Times are Eastern. <Link to="/methods#hearings">About this data</Link>.</p>
    </main>
  );
}
