import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { voteKind } from "../lib/voteKind.js";

// A member's record in date order: roll-call votes (their recorded position, the clerk's wording),
// bills they introduced, their bills that became law, and stock trades they reported. Every member
// gets the same kinds of entries in the same words; nothing is scored or characterized. Each entry
// links to its record. Loads 120 days at a time, newest first.

const SPAN = 120;
const dayIso = (d) => d.toISOString().slice(0, 10);
const back = (iso, days) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - days); return dayIso(d); };
const MONTH = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(tr("en-US", "es-US"), { month: "long", year: "numeric", timeZone: "UTC" });

async function loadWindow(id, from, to) {
  const [votes, bills, laws, trades] = await Promise.all([
    db.from("member_votes").select("vote_id,chamber,question,result,voted_at,description,document_name,source_url,position")
      .eq("bioguide_id", id).gte("voted_at", from).lt("voted_at", back(to, -1)).order("voted_at", { ascending: false }).limit(1000),
    db.from("bills").select("congress,bill_type,number,title,short_title,introduced_date")
      .eq("sponsor_bioguide_id", id).gte("introduced_date", from).lte("introduced_date", to).order("introduced_date", { ascending: false }).limit(500),
    db.from("bills").select("congress,bill_type,number,title,short_title,became_law_date,law_number")
      .eq("sponsor_bioguide_id", id).gte("became_law_date", from).lte("became_law_date", to).limit(100),
    db.from("stock_trades_dedup").select("filing_id,row_num,owner,asset_name,ticker,transaction_type,transaction_date,amount_text,filed_date,source_url")
      .eq("bioguide_id", id).gte("transaction_date", from).lte("transaction_date", to).limit(500),
  ]);
  const err = [votes, bills, laws, trades].find((r) => r.error);
  if (err) throw err.error;
  const out = [];
  for (const v of votes.data) {
    const k = voteKind(v);
    out.push({ date: v.voted_at.slice(0, 10), type: "vote", main: ["passage", "nomination"].includes(k.kind), v, k });
  }
  for (const b of bills.data) out.push({ date: b.introduced_date, type: "bill", main: true, b });
  for (const b of laws.data) out.push({ date: b.became_law_date, type: "law", main: true, b });
  for (const t of trades.data) out.push({ date: t.transaction_date, type: "trade", main: true, t });
  return out;
}

function Entry({ e }) {
  if (e.type === "vote") {
    const { v, k } = e;
    // Nominations are named by the clerk's description (the nominee and post), not the PN number;
    // other votes by the measure's number and its description.
    const what = k.kind === "nomination" ? (v.description || v.document_name)
      : [v.document_name, v.description].filter(Boolean).join(": ");
    return (
      <>
        <span className="tl-kind">{tr("Vote", "Voto")}</span>
        <span>
          <strong lang="en">{v.position}</strong>{" "}{tr("on", "en")} {k.label.toLowerCase()}{what && <>: <span lang="en" className="clamp2-inline">{what}</span></>}
          <span className="fine"> · <span lang="en">{v.result}</span> · <a href={v.source_url} rel="noopener">{tr("Roll call", "Votación")}</a></span>
        </span>
      </>
    );
  }
  if (e.type === "bill" || e.type === "law") {
    const b = e.b;
    return (
      <>
        <span className="tl-kind">{e.type === "law" ? tr("Law", "Ley") : tr("Bill", "Proyecto")}</span>
        <span>
          {e.type === "law" ? tr("Their bill became law: ", "Su proyecto se convirtió en ley: ") : tr("Introduced ", "Presentó ")}
          <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link>{" "}
          <span lang="en" className="clamp2-inline">{b.short_title ?? b.title}</span>
          {e.type === "law" && b.law_number && <span className="fine"> · {tr("Public Law", "Ley Pública")} {b.law_number}</span>}
        </span>
      </>
    );
  }
  const t = e.t;
  return (
    <>
      <span className="tl-kind">{tr("Trade", "Operación")}</span>
      <span>
        <span lang="en">{t.transaction_type}</span>{": "}<span lang="en">{t.asset_name}{t.ticker ? ` (${t.ticker})` : ""}</span>
        <span className="fine"> · {t.amount_text}{t.owner && t.owner !== "Self" ? ` · ${t.owner}` : ""} · {tr("reported", "declarada el")} {date(t.filed_date)} · <a href={t.source_url} rel="noopener">{tr("Filing", "Declaración")}</a></span>
      </span>
    </>
  );
}

export default function MemberTimeline({ bioguide }) {
  const today = dayIso(new Date());
  const [entries, setEntries] = useState([]);
  const [until, setUntil] = useState(today);  // oldest day loaded so far
  const [status, setStatus] = useState("loading");
  const [all, setAll] = useState(false);
  const [openDays, setOpenDays] = useState(() => new Set());

  const loadMore = (to) => {
    const from = back(to, SPAN);
    setStatus("loading");
    loadWindow(bioguide, from, to)
      .then((rows) => { setEntries((e) => [...e, ...rows]); setUntil(back(from, 1)); setStatus("done"); })
      .catch(() => setStatus("error"));
  };
  useEffect(() => { setEntries([]); loadMore(today); }, [bioguide]);

  const shown = entries.filter((e) => all || e.main).sort((a, z) => z.date.localeCompare(a.date) || a.type.localeCompare(z.type));
  const days = shown.reduce((m, e) => m.set(e.date, [...(m.get(e.date) ?? []), e]), new Map());
  const hiddenVotes = entries.filter((e) => e.type === "vote" && !e.main).length;
  let month = null;

  return (
    <div className="timeline">
      <div className="seg-toggle" role="group" aria-label={tr("Show", "Mostrar")}>
        <button type="button" aria-pressed={!all} onClick={() => setAll(false)}>{tr("Main events", "Hechos principales")}</button>
        <button type="button" aria-pressed={all} onClick={() => setAll(true)}>{tr("Every roll call", "Todas las votaciones")}</button>
      </div>
      <p className="fine">
        {all ? tr("Every recorded vote, including amendments and procedural votes.", "Cada voto registrado, incluidas enmiendas y votos de procedimiento.")
          : tr(`Final-passage and confirmation votes, bills introduced, bills that became law, and reported stock trades.${hiddenVotes ? ` ${hiddenVotes} other votes in this period are under "Every roll call".` : ""}`,
            `Votos de aprobación final y de confirmación, proyectos presentados, proyectos que se convirtieron en ley y operaciones bursátiles declaradas.${hiddenVotes ? ` Otros ${hiddenVotes} votos de este período están en "Todas las votaciones".` : ""}`)}
      </p>
      {status === "error" && <p className="notice">{tr("The record didn't load. Try again.", "El historial no se cargó. Inténtelo de nuevo.")}</p>}
      <ol className="bare tl-days">
        {[...days].map(([d, list]) => {
          const m = MONTH(d);
          const head = m !== month ? <li key={`m-${m}`} className="tl-month" aria-hidden="true">{m}</li> : null;
          month = m;
          // A day with many votes shows the first few; the rest open on request.
          const many = list.length > 6 && !openDays.has(d);
          return [head, (
            <li key={d} className="tl-day">
              <h4 className="tl-date">{date(d)}</h4>
              <ul className="bare">
                {(many ? list.slice(0, 5) : list).map((e, i) => <li key={i} className="tl-entry"><Entry e={e} /></li>)}
              </ul>
              {many && <button type="button" className="link fine" onClick={() => setOpenDays((s) => new Set(s).add(d))}>{tr(`Show all ${list.length} entries for this day`, `Ver las ${list.length} entradas de este día`)}</button>}
            </li>
          )];
        })}
      </ol>
      {status === "done" && shown.length === 0 && <p>{tr("Nothing in this period.", "Nada en este período.")}</p>}
      <p>
        {status === "loading" ? <span className="fine">{tr("Loading…", "Cargando…")}</span> : until >= "2023-01-01" && (
          <button type="button" className="button-secondary" onClick={() => loadMore(until)}>{tr(`Show earlier (before ${date(back(until, -1))})`, `Ver antes (antes del ${date(back(until, -1))})`)}</button>
        )}
      </p>
    </div>
  );
}
