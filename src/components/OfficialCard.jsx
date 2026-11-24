import { Link } from "react-router-dom";
import { seatLabel, date, partyName } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";
import { PartyName } from "./PartyTag.jsx";

// One official in the lookup results. Identical layout for every party.
export default function OfficialCard({ official }) {
  const { t } = useLang();
  if (official.seat_status === "pending_update") {
    return (
      <li className="card pending">
        <p className="seat">{seatLabel(official)}</p>
        <p>{t(`A new term began on ${date(official.end_date)}. Information for this seat is being updated.`, `Un nuevo período comenzó el ${date(official.end_date)}. La información de este escaño se está actualizando.`)}</p>
      </li>
    );
  }
  return (
    <li className="card">
      <p className="seat">{seatLabel(official)}</p>
      <img className="member-photo small" src={`https://unitedstates.github.io/images/congress/225x275/${official.bioguide_id}.jpg`} alt={official.name} width="60" height="73" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
      <h3><Link to={`/member/${official.bioguide_id}`}>{official.name}</Link></h3>
      <p className="meta"><PartyName party={official.party} /> · {t("Serving since", "En el cargo desde el")} {date(official.start_date)}</p>
    </li>
  );
}
