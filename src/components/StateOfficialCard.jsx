import { Link } from "react-router-dom";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { stateOfficeLabel, stateParty } from "../lib/stateOffices.js";

export function StatePartyTag({ party }) {
  const p = stateParty(party);
  if (!p) return null;
  return <span className={`party party-${p.kind}`} title={party}>{p.letter}</span>;
}

export const statePersonPath = (id) => `/state/person/${id.replace(/^ocd-person\//, "")}`;

// One state official in the lookup results. Same layout as federal cards, for every party.
export default function StateOfficialCard({ official, state }) {
  return (
    <li className="card">
      <p className="seat">{stateOfficeLabel(official, state)}</p>
      <h3><Link to={statePersonPath(official.id)}>{official.name}</Link></h3>
      <p className="meta">
        <StatePartyTag party={official.party} /> {official.party}
        {official.start_date && <> · {tr("In this office since", "En este cargo desde el")} {date(official.start_date)}</>}
      </p>
    </li>
  );
}
