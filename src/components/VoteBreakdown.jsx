import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { tr } from "../lib/lang.js";
import { partyName } from "../lib/format.js";
import { db } from "../lib/db.js";
import { myRepresentatives } from "../lib/myReps.js";

// How each member voted on one roll call: counts by party, then everyone by position.
// Members the visitor looked up on the home page (kept only in this browser tab) are marked.
export default function VoteBreakdown({ voteId }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(false);
  const [stateFilter, setStateFilter] = useState("");
  const mine = useMemo(() => myRepresentatives(), []);

  useEffect(() => {
    db.from("vote_position_details").select("bioguide_id,name,last_name,position,party_at_vote,state_at_vote")
      .eq("vote_id", voteId).order("last_name").limit(1000)
      .then(({ data, error: e }) => (e ? setError(true) : setRows(data)));
  }, [voteId]);

  const { positions, parties, table, byPosition, states } = useMemo(() => {
    const list = rows ?? [];
    const positions = [...new Set(list.map((r) => r.position))].sort((x, y) =>
      list.filter((r) => r.position === y).length - list.filter((r) => r.position === x).length);
    const parties = [...new Set(list.map((r) => r.party_at_vote))].sort();
    const table = Object.fromEntries(parties.map((p) => [p, Object.fromEntries(positions.map((pos) =>
      [pos, list.filter((r) => r.party_at_vote === p && r.position === pos).length]))]));
    const shown = list.filter((r) => !stateFilter || r.state_at_vote === stateFilter);
    const byPosition = positions.map((pos) => [pos, shown.filter((r) => r.position === pos)]);
    const states = [...new Set(list.map((r) => r.state_at_vote))].sort();
    return { positions, parties, table, byPosition, states };
  }, [rows, stateFilter]);

  if (error) return <p className="fine">{tr("Couldn't load how members voted.", "No se pudo cargar cómo votaron los miembros.")}</p>;
  if (!rows) return <p className="fine">{tr("Loading…", "Cargando…")}</p>;
  const myRows = rows.filter((r) => mine.has(r.bioguide_id));

  return (
    <div className="breakdown">
      {myRows.length > 0 && (
        <p><strong>{tr("Your representatives", "Sus representantes")}:</strong> {myRows.map((r, i) => (
          <span key={r.bioguide_id}>{i ? "; " : ""}<Link to={`/member/${r.bioguide_id}`}>{r.name}</Link> — {r.position}</span>
        ))}</p>
      )}
      <table>
        <thead><tr><th>{tr("Party", "Partido")}</th>{positions.map((p) => <th key={p}>{p}</th>)}</tr></thead>
        <tbody>
          {parties.map((party) => (
            <tr key={party}><td>{partyName(party)}</td>{positions.map((p) => <td key={p}>{table[party][p]}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <label className="fine">{tr("State", "Estado")}{" "}
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="">{tr("All", "Todos")}</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      {byPosition.map(([pos, list]) => list.length > 0 && (
        <div key={pos}>
          <h3 className="small">{pos} ({list.length})</h3>
          <p className="names">
            {list.map((r, i) => (
              <span key={r.bioguide_id} className={mine.has(r.bioguide_id) ? "mine" : ""}>
                {i ? ", " : ""}<Link to={`/member/${r.bioguide_id}`}>{r.last_name}</Link> ({r.party_at_vote?.[0]}-{r.state_at_vote})
              </span>
            ))}
          </p>
        </div>
      ))}
      <p className="fine">{tr("Party and state as recorded by the clerk at the time of the vote.", "Partido y estado tal como los registró el secretario al momento de la votación. Yea/Aye = sí; Nay/No = no.")}</p>
    </div>
  );
}
