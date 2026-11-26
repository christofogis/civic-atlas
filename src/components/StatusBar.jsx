import { Link } from "react-router-dom";
import { billTrack, trackSentence, stepLabelEs } from "../../lib/billTrack.js";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";

// "Became law (Public Law 119-21)" keeps the law number as published.
export const label = (l) => tr(l, stepLabelEs(l));

// What the line under each step says, in words, so the state never depends on color alone.
function stepNote(s) {
  switch (s.state) {
    case "done": case "failed": return date(s.date);
    case "current":
      return s.key === "committee"
        ? (s.referredDate ? tr(`Referred ${date(s.referredDate)}`, `Remitido el ${date(s.referredDate)}`) : tr("In committee", "En comité"))
        : tr("Next step", "Siguiente paso");
    case "unknown": return s.notInRecord ? tr("Not in our records", "No está en nuestros registros") : tr("Date not in the record", "Fecha no registrada");
    case "no_report": return tr("No committee report in the record", "Sin informe de comité registrado");
    default: return s.notInRecord ? tr("Not in our records", "No está en nuestros registros") : "";
  }
}

// Where a bill stands: each step with the date it happened, the current step, and one plain
// sentence on what happens next. Steps come from lib/billTrack.js; /methods#bill-stage explains them.
export default function StatusBar({ bill, referrals, votes, scheduled }) {
  const t = billTrack(bill, { referrals, votes, scheduled });
  const sentence = trackSentence(t, date);
  return (
    <section className="bill-track" aria-labelledby="bill-track-h">
      <h2 id="bill-track-h" className="bill-track-h">{tr("Where it stands", "En qué etapa está")}</h2>
      <p className="bill-track-next">{tr(sentence.en, sentence.es)}</p>
      <ol className="status-bar">
        {t.steps.map((s, i) => {
          const shown = s.state === "done" || s.state === "failed" || s.state === "unknown" ? s.label : s.pendingLabel;
          const text = s.key === "law" && s.state === "done" && s.law_number ? `${s.label} (${s.law_number})` : shown;
          return (
            <li key={s.key} className={`step ${s.state}`} aria-current={i === t.current ? "step" : undefined}>
              <span className="step-label">{text === shown ? label(shown) : tr(text, `${stepLabelEs(s.label)} (${s.law_number})`)}</span>
              <span className="step-date">
                {stepNote(s)}
                {s.vote?.source_url && <> · <a href={s.vote.source_url}>{tr("roll call", "votación")}</a></>}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="fine"><Link to="/methods#bill-stage">{tr("How the stage is determined", "Cómo se determina la etapa")}</Link></p>
    </section>
  );
}
