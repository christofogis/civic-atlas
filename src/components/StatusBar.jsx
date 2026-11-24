import { billSteps } from "../../lib/billprogress.js";
import { date } from "../lib/format.js";

// Where a bill stands: each step with the date it happened. Steps not reached are grey.
// "Reported by committee" is shown as skipped when the bill moved on without it.
export default function StatusBar({ bill }) {
  const steps = billSteps(bill);
  const lastDone = steps.reduce((n, s, i) => (s.date ? i : n), -1);
  return (
    <ol className="status-bar" aria-label="Where this bill stands">
      {steps.map((s, i) => {
        const state = s.date ? (s.failed ? "failed" : "done") : s.optional && i < lastDone ? "skipped" : "todo";
        return (
          <li key={s.label} className={`step ${state}`}>
            <span className="step-label">{s.label}</span>
            <span className="step-date">{s.date ? date(s.date) : state === "skipped" ? "Skipped" : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
