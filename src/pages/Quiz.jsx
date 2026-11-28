import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, date, partyTag } from "../lib/format.js";
import { quizCandidates, QUIZ_QUESTIONS } from "../lib/quizPick.js";
import { myRepresentatives } from "../lib/myReps.js";
import { congressOn } from "../../lib/congress.js";
import { tr } from "../lib/lang.js";
import { PartyTag } from "../components/PartyTag.jsx";
import Clamp from "../components/Clamp.jsx";
import { PlainSummary } from "../components/PlainSummary.jsx";
import { fetchPlainSummaries, fetchSimpleSummaries, plainKey, plainFilter } from "../lib/plainSummaries.js";
import { Terms } from "../components/Terms.jsx";

const QUESTIONS = QUIZ_QUESTIONS;

// The fixed rule for which bills appear (no one picks them; src/lib/quizPick.js): the most recent
// final-passage roll calls in the current Congress that were contested and are on a bill with a CRS
// summary. One question per bill; a bill voted on in both chambers is compared in each.
async function loadQuestions() {
  const congress = congressOn();
  const { data: votes, error } = await db.from("votes")
    .select("vote_id,chamber,voted_at,question,description,result,yea_total,nay_total,source_url,bill_congress,bill_type,bill_number")
    .eq("congress", congress).not("bill_type", "is", null)
    .order("voted_at", { ascending: false }).limit(1000);
  if (error) throw error;
  const candidates = quizCandidates(votes);
  // Two requests instead of one per candidate (up to 40, each with its own CORS preflight, which
  // made this the slowest page on a phone): first which candidates have a CRS summary, then the
  // full rows for the ten asked about.
  const asBill = (k) => { const [congress, bill_type, number] = k.split("-"); return { congress, bill_type, number }; };
  const { data: withSummary, error: e1 } = await db.from("bills").select("congress,bill_type,number")
    .not("crs_summary", "is", null).or(plainFilter(candidates.map((c) => asBill(c.key))).join(","));
  if (e1) throw e1;
  const has = new Set((withSummary ?? []).map((b) => plainKey(b.congress, b.bill_type, b.number)));
  const picked = candidates.filter((c) => has.has(c.key.toLowerCase())).slice(0, QUESTIONS);
  if (!picked.length) return [];
  const { data: rows, error: e2 } = await db.from("bills").select("congress,bill_type,number,title,short_title,crs_summary,law_number,source_url")
    .or(plainFilter(picked.map((c) => asBill(c.key))).join(","));
  if (e2) throw e2;
  const byKey = new Map((rows ?? []).map((b) => [plainKey(b.congress, b.bill_type, b.number), b]));
  const qs = picked.map((c) => ({ ...c, bill: byKey.get(c.key.toLowerCase()) })).filter((q) => q.bill?.crs_summary);
  // Short AI summaries where one has been published; the CRS text stays one tap away.
  // The simpler version ("Explain it simply") only where a plain summary is shown too.
  const [plain, simple] = await Promise.all([
    fetchPlainSummaries(qs.map((q) => q.bill)).catch(() => new Map()),
    fetchSimpleSummaries(qs.map((q) => q.bill)).catch(() => new Map()),
  ]);
  const k = (b) => plainKey(b.congress, b.bill_type, b.number);
  return qs.map((q) => ({ ...q, plain: plain.get(k(q.bill)) ?? null, simple: simple.get(k(q.bill)) ?? null }));
}

async function loadPositions(voteIds) {
  const rows = await Promise.all(voteIds.map((id) =>
    db.from("vote_position_details").select("vote_id,bioguide_id,name,position,position_category,party_at_vote,state_at_vote")
      .eq("vote_id", id).limit(500).then(({ data }) => data ?? [])));
  return rows.flat();
}

// The short AI summary first, with the CRS summary it was checked against behind "Official summary";
// without a published AI summary, the CRS text cut to a few lines with "more".
function Summary({ q }) {
  const b = q.bill;
  const crsId = `crs-${q.key}`;
  if (!q.plain) return <p lang="en"><Clamp lines={3}><Terms text={b.crs_summary} lang="en" /></Clamp></p>;
  return (
    <>
      <PlainSummary row={q.plain} simple={q.simple} bill={b} crsHref={`#${crsId}`} />
      <details className="crs-official" id={crsId}>
        <summary>{tr("Official summary (CRS)", "Resumen oficial (CRS, en inglés)")}</summary>
        <p lang="en"><Terms text={b.crs_summary} lang="en" /></p>
      </details>
    </>
  );
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
      <p className="fine">{tr(`Question ${step + 1} of ${qs.length}. Answer the way you would have voted; party labels are shown only at the end.`, `Pregunta ${step + 1} de ${qs.length}. Responda como habría votado; los partidos se muestran solo al final.`)}</p>
      <section className="quiz-card">
        <p className="fine">
          {seen.size > 0 && !seen.has(q.key) && <><span className="status-flag ok">{tr("New since your last visit", "Nuevo desde su última visita")}</span>{" "}</>}
          {billLabel(b)}{b.law_number ? tr(` · became ${b.law_number}`, ` · se convirtió en ${b.law_number}`) : ""}
          {Object.values(q.votes)[0]?.voted_at && <> · {tr("voted", "votado el")} {date(Object.values(q.votes)[0].voted_at)}</>}
        </p>
        <h2>{b.short_title ?? b.title}</h2>
        <Summary q={q} key={q.key} />
        <p className="fine">{!q.plain && <>{tr("Summary by the Congressional Research Service.", "Resumen del Servicio de Investigación del Congreso, en inglés.")} </>}<Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`} target="_blank">{tr("Bill page", "Página del proyecto")}</Link></p>
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
