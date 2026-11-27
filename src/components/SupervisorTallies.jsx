import { useState } from "react";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { boardRecords } from "../../lib/boardVotes.js";

// Each supervisor's recorded votes across the meetings whose minutes have been read: how many
// times the minutes list them under Ayes, Noes, Abstained or Absent, and the items behind every
// vote that wasn't Aye. Counted only where the minutes name a supervisor; nothing is inferred.
const KINDS = [["Ayes", "Aye", "A favor"], ["Noes", "No", "En contra"], ["Abstained", "Abstained", "Abstención"], ["Absent", "Absent", "Ausente"], ["Excused", "Excused", "Excusado"]];

export default function SupervisorTallies({ minutes }) {
  const [who, setWho] = useState(null);
  const meetings = minutes?.meetings ?? [];
  if (!meetings.length) return null;
  const list = boardRecords(minutes);
  const inText = list[0]?.inText.length ?? 0;
  const sel = list.find((r) => r.name === who);
  return (
    <div className="supervisor-tallies">
      <h3>{tr("Supervisors' recorded votes", "Votos registrados de los supervisores")}</h3>
      <p className="fine">{tr(`From the minutes of ${meetings.length} recent meetings (${date(meetings.at(-1).date)} to ${date(meetings[0].date)}). Each count is a vote line in the minutes that names the supervisor.`, `De las actas de ${meetings.length} reuniones recientes (${date(meetings.at(-1).date)} al ${date(meetings[0].date)}). Cada conteo es una línea de votación del acta que nombra al supervisor.`)}{inText > 0 && " " + tr(`${inText} ${inText === 1 ? "action describes" : "actions describe"} a vote in a sentence instead of vote lines and ${inText === 1 ? "isn't" : "aren't"} counted; each supervisor's card lists ${inText === 1 ? "it" : "them"}.`, `${inText} ${inText === 1 ? "acción describe" : "acciones describen"} una votación en una oración en lugar de líneas de votación y no se ${inText === 1 ? "cuenta" : "cuentan"}; la tarjeta de cada supervisor ${inText === 1 ? "la menciona" : "las menciona"}.`)}</p>
      <div className="table-scroll">
        <table>
          <thead><tr><th>{tr("Supervisor", "Supervisor")}</th>{KINDS.map(([k, en, es]) => <th key={k}>{tr(en, es)}</th>)}<th><span className="visually-hidden">{tr("Other items", "Otros asuntos")}</span></th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                {KINDS.map(([k]) => <td key={k}>{r.counts[k] ?? 0}</td>)}
                <td>{r.other.length > 0 && <button type="button" className="link fine" aria-expanded={who === r.name} onClick={() => setWho(who === r.name ? null : r.name)}>{who === r.name ? tr("Hide", "Ocultar") : tr("Items", "Asuntos")}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <ul className="bare agenda-items">
          {sel.other.map((o, k) => (
            <li key={k}>
              <span className="item-no">{o.number}</span>
              <div><strong>{tr(...(KINDS.find(([x]) => x === o.kind) ?? [o.kind, o.kind, o.kind]).slice(1))}</strong> · {date(o.date)} · <span lang="en" className="clamp2-inline">{o.text}</span> <a className="fine" href={o.url} rel="noopener">{tr("Minutes", "Acta")}</a></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
