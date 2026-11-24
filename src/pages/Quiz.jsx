import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, date, partyTag } from "../lib/format.js";
import { voteKind } from "../lib/voteKind.js";
import { myRepresentatives } from "../lib/myReps.js";
import { congressOn } from "../../lib/congress.js";

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
  return <p>{open ? text : `${text.slice(0, 480).replace(/\s+\S*$/, "")}… `}<button className="link" onClick={() => setOpen(!open)}>{open ? "Show less" : "Read more"}</button></p>;
}

export default function Quiz() {
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

  if (state.status === "loading") return <main className="page"><h1>Do you vote like your representatives?</h1><p>Loading…</p></main>;
  if (state.status === "error") return <main className="page"><h1>Do you vote like your representatives?</h1><p className="notice">Couldn't load the questions right now.</p></main>;
  const qs = state.qs;
  if (qs.length === 0) return <main className="page"><h1>Do you vote like your representatives?</h1><p>No contested final votes with summaries yet this Congress.</p></main>;

  if (results) {
    if (results.status === "loading") return <main className="page"><h1>Your results</h1><p>Comparing…</p></main>;
    const pct = (t) => `${Math.round((100 * t.same) / t.total)}%`;
    const row = (t) => <li key={t.bioguide_id}><Link to={`/member/${t.bioguide_id}`}>{t.name}</Link> ({partyTag({ party: t.party_at_vote, state: t.state_at_vote, chamber: t.chamber })}): agreed on {t.same} of {t.total} ({pct(t)})</li>;
    return (
      <main className="page">
        <h1>Your results</h1>
        <p className="lede">You answered {results.answered} of {qs.length} questions with Yes or No.</p>
        <section className="section">
          <h2>Your representatives</h2>
          {mine.size === 0 ? <p><Link to="/">Look up your address</Link>, then come back to compare with your own representatives.</p>
            : results.mine.length === 0 ? <p>Your representatives didn't vote Yea or Nay on the questions you answered.</p>
            : <ul className="plain">{results.mine.map(row)}</ul>}
        </section>
        {["senate", "house"].map((ch) => results[ch].length > 0 && (
          <section className="section" key={ch}>
            <h2>{ch === "senate" ? "Senators" : "House members"} you agreed with most</h2>
            <ul className="plain">{results[ch].slice(0, 5).map(row)}</ul>
            <details><summary className="fine">Everyone in the {ch === "senate" ? "Senate" : "House"} ({results[ch].length})</summary>
              <ul className="plain">{results[ch].map(row)}</ul></details>
          </section>
        ))}
        <p className="fine">
          This compares your answers with members' recorded votes on these {qs.length} bills only, chosen by a fixed rule:
          the most recent contested final votes this Congress on bills with a Congressional Research Service summary.
          It isn't a measure of overall agreement. Your answers stay in your browser and aren't saved.
        </p>
        <p><button className="link" onClick={() => { setResults(null); setStep(0); setAnswers({}); }}>Start over</button></p>
      </main>
    );
  }

  const q = qs[step];
  const b = q.bill;
  const choose = (a) => { setAnswers({ ...answers, [q.key]: a }); if (step < qs.length - 1) setStep(step + 1); else setTimeout(finish, 0); };
  return (
    <main className="page">
      <h1>Do you vote like your representatives?</h1>
      <p className="fine">Question {step + 1} of {qs.length}. Answer the way you would have voted; party labels are shown only at the end.</p>
      <section className="quiz-card">
        <p className="fine">{billLabel(b)}{b.law_number ? ` · became ${b.law_number}` : ""}</p>
        <h2>{b.short_title ?? b.title}</h2>
        <Summary text={b.crs_summary} />
        <p className="fine">Summary by the Congressional Research Service. <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`} target="_blank">Bill page</Link></p>
        <p>Would you have voted for it?</p>
        <div className="quiz-buttons">
          <button type="button" onClick={() => choose("yes")}>Yes</button>
          <button type="button" onClick={() => choose("no")}>No</button>
          <button type="button" className="link" onClick={() => choose("skip")}>Skip</button>
        </div>
        <p className="fine">
          Voted on: {Object.values(q.votes).map((v) => `${v.chamber === "house" ? "House" : "Senate"} ${date(v.voted_at)}`).join(" and ")}.
          Results are revealed at the end.
        </p>
      </section>
      {step > 0 && <p><button className="link" onClick={() => setStep(step - 1)}>← Back</button></p>}
    </main>
  );
}
