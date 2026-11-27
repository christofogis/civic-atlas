import Portrait from "./Portrait.jsx";
import { NO_PHOTO, noPhoto } from "../lib/photo.js";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { date, stateName } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { stateOfficeParts, stateParty } from "../lib/stateOffices.js";
import Seat from "./Seat.jsx";

export function StatePartyTag({ party }) {
  const p = stateParty(party);
  if (!p) return null;
  return <span className={`party party-${p.kind}`} title={party}>{p.letter}</span>;
}

export const statePersonPath = (id) => `/state/person/${id.replace(/^ocd-person\//, "")}`;

// One state official in the lookup results. Same layout as federal cards, for every party.
export default function StateOfficialCard({ official, state }) {
  if (official.updating) {
    return (
      <li className="card pending">
        <Seat parts={stateOfficeParts(official, state)} />
        <p>{tr(`A new term began on ${date(official.term_ended)}. Information for this office is being updated.`, `Un nuevo período comenzó el ${date(official.term_ended)}. La información de este cargo se está actualizando.`)}</p>
      </li>
    );
  }
  return (
    <li className="card">
      <Seat parts={stateOfficeParts(official, state)} />
      <Portrait className="member-photo small" size="small" party={official.party} src={official.image} alt={official.name} width="60" height="73" loading="lazy" referrerPolicy="no-referrer" />
      <h3><Link to={statePersonPath(official.id)}>{official.name}</Link></h3>
      <p className="meta">
        {official.start_date && <>{tr("In this office since", "En este cargo desde el")} {date(official.start_date)}</>}
      </p>
      {official.phone && <p className="fine card-phone"><a href={`tel:${official.phone.replace(/[^\d+]/g, "")}`}>{official.phone}</a></p>}
    </li>
  );
}

// California statewide offices that Open States doesn't list, from /data/state/ca-statewide.json.
// Same card layout; the name links to the office's own website (there's no person page).
export function ExtraStatewideCards({ state, boe = [] }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (state !== "CA") return;
    fetch(`/data/state/${state.toLowerCase()}-statewide.json`).then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, [state]);
  if (!data) return null;
  const today = new Date().toISOString().slice(0, 10);
  const updating = data.seat_change_by && data.seat_change_by <= today;
  const boeCards = (data.boe?.members ?? []).filter((m) => boe.includes(m.district)).map((m) => {
    const seat = <Seat parts={[tr(`${stateName(state)} ${data.boe.title[0]}`, `${data.boe.title[1]} de ${stateName(state)}`), tr(`District ${m.district}`, `Distrito ${m.district}`)]} />;
    return updating ? (
      <li key={`boe-${m.district}`} className="card pending">
        {seat}
        <p>{tr(`A new term began on ${date(data.seat_change_by)}. Information for this office is being updated.`, `Un nuevo período comenzó el ${date(data.seat_change_by)}. La información de este cargo se está actualizando.`)}</p>
      </li>
    ) : (
      <li key={`boe-${m.district}`} className="card">
        {seat}
        <h3><a href={data.boe.website} rel="noopener">{m.name}</a></h3>
        <p className="meta">
          <StatePartyTag party={m.party} /> {m.party}
          {m.start_date && <> · {tr("In this office since", "En este cargo desde el")} {date(m.start_date)}</>}
        </p>
      </li>
    );
  });
  return [...data.offices.map((o) => (
    updating ? (
      <li key={o.office} className="card pending">
        <Seat parts={[tr(o.title[0], o.title[1]), stateName(state)]} />
        <p>{tr(`A new term began on ${date(data.seat_change_by)}. Information for this office is being updated.`, `Un nuevo período comenzó el ${date(data.seat_change_by)}. La información de este cargo se está actualizando.`)}</p>
      </li>
    ) : (
      <li key={o.office} className="card">
        <Seat parts={[tr(o.title[0], o.title[1]), stateName(state)]} />
        <h3><a href={o.website} rel="noopener">{o.name}</a></h3>
        <p className="meta">
          {o.nonpartisan ? tr("Nonpartisan office", "Cargo no partidista") : <><StatePartyTag party={o.party} /> {o.party}</>}
          {o.start_date && <> · {tr("In this office since", "En este cargo desde el")} {date(o.start_date)}</>}
        </p>
      </li>
    )
  )), ...boeCards];
}
