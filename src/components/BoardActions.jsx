import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";

// What the Board of Supervisors did on each item at one meeting, from the Clerk's summary action
// minutes: the item as printed, each motion, and the vote lines exactly as recorded. The minutes
// print motions in capitals; they're shown in sentence case with supervisors' names capitalized,
// with the words unchanged.
const VOTE_LABEL = {
  Ayes: ["Ayes", "A favor"], Noes: ["Noes", "En contra"], Abstained: ["Abstained", "Se abstuvieron"],
  Absent: ["Absent", "Ausentes"], Excused: ["Excused", "Excusados"], Recused: ["Recused", "Se recusaron"],
};

function sentenceCase(text, names) {
  const lower = text.toLowerCase().replace(/(^|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const proper = new Set([...names, "Chair", "Vice", "Supervisor", "Board", "Orange", "County", "OC"].map((n) => n.toLowerCase()));
  return lower.replace(/\b([a-z][a-z'-]*)\b/g, (w) => (proper.has(w) ? w[0].toUpperCase() + w.slice(1) : w))
    .replace(/\b(a\.m\.|p\.m\.)/g, (w) => w.toUpperCase());
}

export default function BoardActions({ meeting }) {
  const names = [...new Set(meeting.items.flatMap((i) => i.actions.flatMap((a) => Object.values(a.votes).flat())))];
  return (
    <details className="board-actions">
      <summary>{tr(`What the Board did on each of ${meeting.items.length} items`, `Lo que hizo la Junta en cada uno de los ${meeting.items.length} asuntos`)}</summary>
      <ul className="bare agenda-items">
        {meeting.items.map((i) => {
          const dept = i.text.includes(" - ") ? i.text.split(" - ")[0] : null;
          return (
            <li key={i.number} lang="en">
              <span className="item-no">{i.number}</span>
              <div>
                <span className="clamp2-inline">{dept ? <><strong>{dept}</strong>{i.text.slice(dept.length)}</> : i.text}</span>
                {i.actions.map((a, k) => (
                  <div key={k} className="board-action">
                    <div>{sentenceCase(a.motion, names)}</div>
                    {Object.entries(a.votes).map(([kind, who]) => (
                      <div key={kind} className="fine"><span className="vote-kind">{tr(...(VOTE_LABEL[kind] ?? [kind, kind]))}:</span> {who.join(", ")}</div>
                    ))}
                    {a.vote_in_text && <div className="fine">{tr("The minutes describe this vote in the sentence above, without vote lines, so it isn't in the supervisors' counts.", "El acta describe esta votación en la oración anterior, sin líneas de votación, así que no está en los conteos de los supervisores.")}</div>}
                    {(a.notes ?? []).map((n) => <div key={n} className="fine">{n}</div>)}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="fine">{tr(`From the Clerk of the Board's summary action minutes for ${date(meeting.date)}, as recorded. Where the minutes list only some supervisors on a vote, only those are shown.`, `Del acta resumida de acciones de la Secretaría de la Junta del ${date(meeting.date)}, tal como se registró. Cuando el acta menciona solo a algunos supervisores en una votación, solo se muestran esos.`)} <a href={meeting.minutes_url} rel="noopener">{tr("Minutes (PDF)", "Acta (PDF)")}</a></p>
    </details>
  );
}
