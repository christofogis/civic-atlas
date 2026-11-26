import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { KINDS, supervisorRecord, surname } from "../../lib/boardVotes.js";

// One supervisor's votes as recorded in the Clerk of the Board's summary action minutes: counts by
// kind, and the items behind every vote that wasn't Aye, each with its meeting date and a link to
// the minutes. Same layout and wording for every supervisor. Counted only where a vote line names
// the supervisor; nothing is inferred.
export const KIND_LABEL = {
  Ayes: ["Aye", "A favor"], Noes: ["No", "En contra"], Abstained: ["Abstained", "Abstención"],
  Absent: ["Absent", "Ausente"], Excused: ["Excused", "Excusado"], Recused: ["Recused", "Se recusó"],
};
const label = (k) => tr(...(KIND_LABEL[k] ?? [k, k]));

function Ref({ o }) {
  return (
    <>
      {date(o.date)}{o.special && <> · {tr("special meeting", "reunión especial")}</>} · {tr("item", "asunto")} {o.number}
      {" · "}<a href={o.url} rel="noopener">{tr("Minutes", "Acta")}</a>
    </>
  );
}

export default function SupervisorRecord({ minutes, name }) {
  if (!minutes?.meetings?.length) return null;
  const r = supervisorRecord(minutes, name);
  const last = surname(name);
  const kinds = [...KINDS, ...(r.counts.Recused ? ["Recused"] : [])];
  return (
    <div className="supervisor-record">
      <h4>{tr("Recorded votes", "Votos registrados")}</h4>
      <p className="record-counts">{kinds.map((k, n) => <span key={k}>{n ? " · " : ""}{label(k)} <strong>{r.counts[k] ?? 0}</strong></span>)}</p>
      <p className="fine">{tr(`From the Clerk of the Board's minutes of ${r.meetings} meetings, ${date(r.from)} to ${date(r.to)}. Each count is a vote line that names ${last}.`, `De las actas de la Secretaría de la Junta de ${r.meetings} reuniones, del ${date(r.from)} al ${date(r.to)}. Cada conteo es una línea de votación que nombra a ${last}.`)}</p>
      {r.unnamed > 0 && <p className="fine">{tr(`On ${r.unnamed} ${r.unnamed === 1 ? "motion" : "motions"}, the vote lines list only part of the Board and don't name ${last}; ${r.unnamed === 1 ? "it isn't" : "they aren't"} counted here.`, `En ${r.unnamed} ${r.unnamed === 1 ? "moción" : "mociones"}, las líneas de votación mencionan solo a parte de la Junta y no nombran a ${last}; no se ${r.unnamed === 1 ? "cuenta" : "cuentan"} aquí.`)}</p>}
      {r.other.length > 0 && (
        <details>
          <summary>{tr(`Votes other than Aye (${r.other.length})`, `Votos distintos de a favor (${r.other.length})`)}</summary>
          <ul className="bare record-items">
            {r.other.map((o, k) => (
              <li key={k}>
                <strong>{label(o.kind)}</strong> · <Ref o={o} />
                <div lang="en" className="clamp2-inline">{o.text}</div>
                {o.partial && <div className="fine">{tr("The vote lines for this motion list only part of the Board.", "Las líneas de votación de esta moción mencionan solo a parte de la Junta.")}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}
      {r.inText.length > 0 && (
        <details>
          <summary>{tr(`Votes described in a paragraph, not counted (${r.inText.length})`, `Votos descritos en un párrafo, no contados (${r.inText.length})`)}</summary>
          <p className="fine">{tr("For these actions the minutes describe the vote in a sentence instead of vote lines, so they aren't in any supervisor's counts. Read each in the minutes.", "En estas acciones el acta describe la votación en una oración en lugar de líneas de votación, así que no están en los conteos de ningún supervisor. Lea cada una en el acta.")}</p>
          <ul className="bare record-items">
            {r.inText.map((o, k) => (
              <li key={k}><Ref o={o} /><div lang="en" className="clamp2-inline">{o.text}</div></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
