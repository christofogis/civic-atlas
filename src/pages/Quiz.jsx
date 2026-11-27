import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, date, partyTag } from "../lib/format.js";
import { voteKind } from "../lib/voteKind.js";
import { myRepresentatives } from "../lib/myReps.js";
import { congressOn } from "../../lib/congress.js";
import { tr } from "../lib/lang.js";
import { PartyTag } from "../components/PartyTag.jsx";

const QUESTIONS = 10;
const MIN_SHARE = 0.1;   // each side needs at least 10% of the votes, so the vote was contested

// The fixed rule for which bills appear (no one picks them): the most recent final-passage roll
// calls in the current Congress that were contested and are on a bill with a CRS summary.
// One question per bill; a bill voted on in both chambers is compared in each.
async function loadQuestions() {
  const congress = congressOn();
  const { data: votes, error } = await db.from("votes")
    .select("vote_id,chamber,voted_at,question,description,result,yea_total,nay_total,source_url,bill_congress,bill_type,bill_number")
    .eq("congress", congress).not("bill_type", "is", null)
    .order("voted_at", { ascending: false }).limit(1000);
  if (error) throw error;
  const contested = votes.filter((v) => {
    const cast = (v.yea_total ?? 0) + (v.nay_total ?? 0);
    return voteKind(v).kind === "passage" && cast > 0 && Math.min(v.yea_total, v.nay_total) / cast >= MIN_SHARE;
  });
  const byBill = new Map();
  for (const v of contested) {
    const k = `${v.bill_congress}-${v.bill_type}-${v.bill_number}`;
    const entry = byBill.get(k) ?? { key: k, votes: {} };
    entry.votes[v.chamber] ??= v;   // latest final vote in each chamber
    byBill.set(k, entry);
  }
  const candidates = [...byBill.values()].slice(0, 40);
  const bills = await Promise.all(candidates.map(async (c) => {
    const [cg, t, n] = c.key.split("-");
    const { data } = await db.from("bills").select("congress,bill_type,number,title,short_title,crs_summary,law_number")
      .eq("congress", cg).eq("bill_type", t).eq("number", n).maybeSingle();
    return data?.crs_summary ? { ...c, bill: data } : null;
  }));
  return bills.filter(Boolean).slice(0, QUESTIONS);
}

async function loadPositions(voteIds) {
  const rows = await Promise.all(voteIds.map((id) =>
    db.from("vote_position_details").select("vote_id,bioguide_id,name,position,position_category,party_at_vote,state_at_vote")
      .eq("vote_id", id).limit(500).then(({ data }) => data ?? [])));
  return rows.flat();
}

function Summary({ text }) {
  const [open, setOpen] = useState(false);
  if (text.length <= 500) return <p>{text}</p>;
  return <p>{open ? text : `${text.slice(0, 480).replace(/\s+\S*$/, "")}… `}<button className="link" onClick={() => setOpen(!open)}>{open ? tr("Show less", "Mostrar menos") : tr("Read more", "Leer más")}</button></p>;
}

// Bills already asked about on this device, so a returning visitor can see which questions are
// new (the set refreshes as Congress takes contested final votes). Stored only in this browser.
const SEEN_KEY = "civic-atlas:quiz-seen";
const readSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]")); } catch { return new Set(); } };
const saveSeen = (keys) => { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), ...keys])].slice(-200))); } catch { /* storage off */ } };

export default function Quiz() {
  const [seen] = useState(readSeen);
  const [state, setState] = useState({ status: "loading" });
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [results, setResults] = useState(null);
  const mine = useMemo(() => myRepresentatives(), []);

  useEffect(() => {
    loadQuestions().then((qs) => setState({ status: "done", qs })).catch(() => setState({ status: "error" }));
  }, []);

  async function finish() {
    setResults({ status: "loading" });
    const qs = state.qs;
    saveSeen(qs.map((q) => q.key));
    const voteIds = qs.flatMap((q) => Object.values(q.votes).map((v) => v.vote_id));
    const positions = await loadPositions(voteIds);
    // For each member: of the questions you answered where they voted Yea or Nay, how many matched.
    const tally = new Map();
    for (const q of qs) {
      const a = answers[q.key];
      if (a !== "yes" && a !== "no") continue;
      for (const v of Object.values(q.votes)) {
        for (const p of positions.filter((x) => x.vote_id === v.vote_id)) {
          if (p.position_category !== "yes" && p.position_category !== "no") continue;
          const t = tally.get(p.bioguide_id) ?? { ...p, same: 0, total: 0, chamber: v.chamber };
          t.total++;
          if (p.position_category === a) t.same++;
          tally.set(p.bioguide_id, t);
        }
      }
    }
    const answered = Object.values(answers).filter((a) => a === "yes" || a === "no").length;
    const ranked = (chamber) => [...tally.values()].filter((t) => t.chamber === chamber && t.total >= Math.min(3, answered))
      .sort((a, z) => z.same / z.total - a.same / a.total || z.total - a.total);
    setResults({ status: "done", answered, mine: [...tally.values()].filter((t) => mine.has(t.bioguide_id)), house: ranked("house"), senate: ranked("senate") });
  }

  if (state.status === "loading") return <main className="page"><h1>{tr("Do you vote like your representatives?", "¿Vota usted como sus representantes?")}</h1><p>{tr("Loading…", "Cargando…")}</p></main>;
  if (state.status === "error") return <main className="page"><h1>{tr("Do you vote like your representatives?", "¿Vota usted como sus representantes?")}</h1><p className="notice">{tr("Couldn't load the questions right now.", "No se pudieron cargar las preguntas en este momento.")}</p></main>;
  const qs = state.qs;
  if (qs.length === 0) return <main className="page"><h1>{tr("Do you vote like your representatives?", "¿Vota usted como sus representantes?")}</h1><p>{tr("No contested final votes with summaries yet this Congress.", "Todavía no hay votaciones finales disputadas con resumen en este Congreso.")}</p></main>;

  if (results) {
    if (results.status === "loading") return <main className="page"><h1>{tr("Your results", "Sus resultados")}</h1><p>{tr("Comparing…", "Comparando…")}</p></main>;
    const pct = (t) => `${Math.round((100 * t.same) / t.total)}%`;
    const row = (t) => <li key={t.bioguide_id}><Link to={`/member/${t.bioguide_id}`}>{t.name}</Link> <PartyTag p={{ party: t.party_at_vote, state: t.state_at_vote, chamber: t.chamber }} />: {tr(`agreed on ${t.same} of ${t.total}`, `coincidió en ${t.same} de ${t.total}`)} ({pct(t)})</li>;
    return (
      <main className="page">
        <h1>{tr("Your results", "Sus resultados")}</h1>
        <p className="lede">{tr(`You answered ${results.answered} of ${qs.length} questions with Yes or No.`, `Respondió ${results.answered} de ${qs.length} preguntas con Sí o No.`)}</p>
        <section className="section">
          <h2>{tr("Your representatives", "Sus representantes")}</h2>
          {mine.size === 0 ? <p><Link to="/">{tr("Look up your address", "Busque su dirección")}</Link>{tr(", then come back to compare with your own representatives.", " y luego vuelva para compararse con sus representantes.")}</p>
            : results.mine.length === 0 ? <p>{tr("Your representatives didn't vote Yea or Nay on the questions you answered.", "Sus representantes no votaron sí ni no en las preguntas que usted respondió.")}</p>
            : <ul className="plain">{results.mine.map(row)}</ul>}
        </section>
        {["senate", "house"].map((ch) => results[ch].length > 0 && (
          <section className="section" key={ch}>
            <h2>{ch === "senate" ? tr("Senators you agreed with most", "Senadores con quienes más coincidió") : tr("House members you agreed with most", "Miembros de la Cámara con quienes más coincidió")}</h2>
            <ul className="plain">{results[ch].slice(0, 5).map(row)}</ul>
            <details><summary className="fine">{ch === "senate" ? tr("Everyone in the Senate", "Todo el Senado") : tr("Everyone in the House", "Toda la Cámara")} ({results[ch].length})</summary>
              <ul className="plain">{results[ch].map(row)}</ul></details>
          </section>
        ))}
        <p className="fine">
          {tr(`This compares your answers with members' recorded votes on these ${qs.length} bills only, chosen by a fixed rule: the most recent contested final votes this Congress on bills with a Congressional Research Service summary. It isn't a measure of overall agreement. Your answers stay in your browser and aren't saved.`,
            `Esto compara sus respuestas con los votos registrados de los miembros solo en estos ${qs.length} proyectos, elegidos con una regla fija: las votaciones finales disputadas más recientes de este Congreso sobre proyectos con un resumen del Servicio de Investigación del Congreso. No mide la coincidencia en general. Sus respuestas se quedan en su navegador y no se guardan.`)}
        </p>
        <p><button className="link" onClick={() => { setResults(null); setStep(0); setAnswers({}); }}>{tr("Start over", "Empezar de nuevo")}</button></p>
      </main>
    );
  }

  const q = qs[step];
  const b = q.bill;
  const choose = (a) => { setAnswers({ ...answers, [q.key]: a }); if (step < qs.length - 1) setStep(step + 1); else setTimeout(finish, 0); };
  return (
    <main className="page">
      <h1>{tr("Do you vote like your representatives?", "¿Vota usted como sus representantes?")}</h1>
      {step === 0 && seen.size > 0 && (() => {
        const n = qs.filter((x) => !seen.has(x.key)).length;
        return <p>{n ? tr(`${n} of these ${qs.length} questions are new since your last visit: Congress has taken more final votes.`, `${n} de estas ${qs.length} preguntas son nuevas desde su última visita: el Congreso ha tomado más votaciones finales.`)
          : tr("No new final votes since your last visit; these are the same questions.", "No hay nuevas votaciones finales desde su última visita; son las mismas preguntas.")}</p>;
      })()}
      <p className="fine">{tr(`Question ${step + 1} of ${qs.length}. Answer the way you would have voted; party labels are shown only at the end.`, `Pregunta ${step + 1} de ${qs.length}. Responda como habría votado; los partidos se muestran solo al final. Los resúmenes están en inglés.`)}</p>
      <section className="quiz-card">
        <p className="fine">
          {seen.size > 0 && !seen.has(q.key) && <><span className="status-flag ok">{tr("New since your last visit", "Nuevo desde su última visita")}</span>{" "}</>}
          {billLabel(b)}{b.law_number ? tr(` · became ${b.law_number}`, ` · se convirtió en ${b.law_number}`) : ""}
          {Object.values(q.votes)[0]?.voted_at && <> · {tr("voted", "votado el")} {date(Object.values(q.votes)[0].voted_at)}</>}
        </p>
        <h2>{b.short_title ?? b.title}</h2>
        <Summary text={b.crs_summary} />
        <p className="fine">{tr("Summary by the Congressional Research Service.", "Resumen del Servicio de Investigación del Congreso.")} <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`} target="_blank">{tr("Bill page", "Página del proyecto")}</Link></p>
        <p>{tr("Would you have voted for it?", "¿Habría votado a favor?")}</p>
        <div className="quiz-buttons">
          <button type="button" onClick={() => choose("yes")}>{tr("Yes", "Sí")}</button>
          <button type="button" onClick={() => choose("no")}>No</button>
          <button type="button" className="link" onClick={() => choose("skip")}>{tr("Skip", "Omitir")}</button>
        </div>
        <p className="fine">
          {tr("Voted on", "Votado en")}: {Object.values(q.votes).map((v) => `${v.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")} ${date(v.voted_at)}`).join(tr(" and ", " y "))}.{" "}
          {tr("Results are revealed at the end.", "Los resultados se muestran al final.")}
        </p>
      </section>
      {step > 0 && <p><button className="link" onClick={() => setStep(step - 1)}>{tr("← Back", "← Atrás")}</button></p>}
    </main>
  );
}
