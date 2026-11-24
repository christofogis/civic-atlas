import { billSteps } from "../../lib/billprogress.js";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";

const ES = {
  "Introduced": "Presentado", "Reported by committee": "Informado por el comité", "Passed House": "Aprobado por la Cámara",
  "Failed in House": "Rechazado en la Cámara", "Passed Senate": "Aprobado por el Senado", "Failed in Senate": "Rechazado en el Senado",
  "To President": "Enviado al Presidente", "Vetoed": "Vetado", "Became law": "Se convirtió en ley",
  "Agreed to in House": "Adoptado por la Cámara", "Agreed to in Senate": "Adoptado por el Senado",
};
// "Became law (Public Law 119-21)" keeps the law number as published.
const label = (l) => tr(l, l.startsWith("Became law (") ? `Se convirtió en ley (${l.slice(12, -1)})` : ES[l]);

// Where a bill stands: each step with the date it happened. Steps not reached are grey.
// "Reported by committee" is shown as skipped when the bill moved on without it.
export default function StatusBar({ bill }) {
  const steps = billSteps(bill);
  const lastDone = steps.reduce((n, s, i) => (s.date ? i : n), -1);
  return (
    <ol className="status-bar" aria-label={tr("Where this bill stands", "En qué etapa está este proyecto")}>
      {steps.map((s, i) => {
        const state = s.date ? (s.failed ? "failed" : "done") : s.optional && i < lastDone ? "skipped" : "todo";
        return (
          <li key={s.label} className={`step ${state}`}>
            <span className="step-label">{label(s.label)}</span>
            <span className="step-date">{s.date ? date(s.date) : state === "skipped" ? tr("Skipped", "Omitido") : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
