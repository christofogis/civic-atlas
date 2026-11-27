import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { date, seatLabel, partyName } from "../lib/format.js";
import AtAGlance from "../components/AtAGlance.jsx";
import { tr } from "../lib/lang.js";
import { PartyName } from "../components/PartyTag.jsx";
import { servedInCongress } from "../../lib/congress.js";
import VoteResult from "../components/VoteResult.jsx";

const TERRITORIES = new Set(["DC", "PR", "GU", "VI", "AS", "MP"]);
const SITE = typeof window !== "undefined" ? window.location.origin : "";

// A compact member card for news sites to embed in an iframe. It shows the same template
// sentences as the member page, in the same words for everyone, plus recent votes, and links
// back for the full record. Links open in a new tab so the reader stays on the news story.
export default function EmbedMember() {
  const { id } = useParams();
  const [d, setD] = useState(null);

  useEffect(() => {
    if (!/^[A-Z][0-9]{6}$/.test(id ?? "")) { setD({ missing: true }); return; }
    const one = (q) => q.then(({ data, error }) => { if (error) throw error; return data; });
    Promise.all([
      one(db.from("members").select("bioguide_id,official_full_name,first_name,last_name").eq("bioguide_id", id).maybeSingle()),
      one(db.from("terms").select("chamber,state,district,party,start_date,end_date").eq("bioguide_id", id).order("start_date", { ascending: false })),
      one(db.from("seat_holders").select("*").eq("bioguide_id", id).maybeSingle()),
      one(db.from("member_vote_stats").select("*").eq("bioguide_id", id).order("congress", { ascending: false })),
      one(db.from("chamber_vote_medians").select("*")),
      one(db.from("member_bill_stats").select("*").eq("bioguide_id", id).order("congress", { ascending: false })),
      one(db.from("bills").select("congress,bill_type,number").eq("sponsor_bioguide_id", id).not("became_law_date", "is", null)),
      one(db.from("finance_summaries").select("*").eq("bioguide_id", id).order("cycle", { ascending: false })),
      one(db.from("finance_by_size").select("*").eq("bioguide_id", id)),
      one(db.from("member_trade_summary").select("*").eq("bioguide_id", id).maybeSingle()),
      one(db.from("member_votes").select("vote_id,question,result,voted_at,description,document_name,source_url,position")
        .eq("bioguide_id", id).order("voted_at", { ascending: false }).limit(3)),
    ]).then(([member, terms, seat, voteStats, medians, billStats, laws, finance, bySize, tradeSummary, votes]) =>
      setD(member ? { member, terms, seat, voteStats, medians, billStats, laws, finance, bySize, tradeSummary, votes } : { missing: true }))
      .catch(() => setD({ error: true }));
  }, [id]);

  const full = `${SITE}/member/${id}`;
  if (!d) return <div className="embed"><p>{tr("Loading…", "Cargando…")}</p></div>;
  if (d.missing || d.error) return <div className="embed"><p>{d.missing ? tr("Member not found.", "Miembro no encontrado.") : tr("Couldn't load this record right now.", "No se pudo cargar este registro en este momento.")} <a href={SITE} target="_blank" rel="noopener">Civic Atlas</a></p></div>;
  const { member: m, terms, seat, votes } = d;
  const latest = terms[0];
  const name = m.official_full_name ?? `${m.first_name} ${m.last_name}`;
  return (
    <main className="embed">
      <h1><a href={full} target="_blank" rel="noopener">{name}</a></h1>
      <p className="fine">
        {seat?.seat_status === "serving" ? <>{seatLabel(seat)} <PartyName party={seat.party} /></> : latest ? <>{tr("Former member", "Exmiembro")} · {seatLabel(latest)} <PartyName party={latest.party} /></> : ""}
      </p>
      <AtAGlance terms={terms} voteStats={d.voteStats.filter((s) => servedInCongress(terms, s.chamber, s.congress))} medians={d.medians} billStats={d.billStats} laws={d.laws}
        finance={d.finance} bySize={d.bySize} tradeSummary={d.tradeSummary} delegate={latest?.chamber === "house" && TERRITORIES.has(latest.state)}
        note={tr("Filled in from official records, in the same words for every member.", "Redactado a partir de registros oficiales, con las mismas palabras para cada miembro.")} />
      {votes.length > 0 && (
        <>
          <h2>{tr("Recent roll-call votes", "Votaciones nominales recientes")}</h2>
          <ul className="plain">
            {votes.map((v) => (
              <li key={v.vote_id}>
                <strong>{v.position}</strong> · {v.document_name && !v.question?.includes(v.document_name) ? `${v.document_name}: ` : ""}{v.question} · <span className="fine"><VoteResult v={v} plain />, {date(v.voted_at)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="fine embed-foot">
        <a href={full} target="_blank" rel="noopener">{tr("Full record: votes, bills, money and trades", "Registro completo: votos, proyectos, dinero y acciones")}</a> · {tr("From official sources, via Civic Atlas", "De fuentes oficiales, vía Civic Atlas")}
      </p>
    </main>
  );
}
