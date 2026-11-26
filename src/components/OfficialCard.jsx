import Portrait from "./Portrait.jsx";
import { Link } from "react-router-dom";
import { seatParts, date } from "../lib/format.js";
import Seat from "./Seat.jsx";
import { useLang } from "../lib/i18n.jsx";
import { PartyName } from "./PartyTag.jsx";

// One official in the lookup results. Identical layout for every party.
export default function OfficialCard({ official }) {
  const { t } = useLang();
  if (official.seat_status === "pending_update") {
    return (
      <li className="card pending">
        <Seat parts={seatParts(official)} />
        <p>{t(`A new term began on ${date(official.end_date)}. Information for this seat is being updated.`, `Un nuevo período comenzó el ${date(official.end_date)}. La información de este escaño se está actualizando.`)}</p>
      </li>
    );
  }
  return (
    <li className="card">
      <Seat parts={seatParts(official)} />
      <Portrait className="member-photo small" size="small" party={official.party} src={`https://unitedstates.github.io/images/congress/225x275/${official.bioguide_id}.jpg`} alt={official.name} width="60" height="73" loading="lazy" />
      <h3><Link to={`/member/${official.bioguide_id}`}>{official.name}</Link></h3>
      <p className="meta"><PartyName party={official.party} /> · {t("Current term began", "Período actual desde el")} {date(official.start_date)}</p>
      {official.phone && <p className="fine card-phone"><a href={`tel:${official.phone.replace(/[^\d+]/g, "")}`}>{official.phone}</a> <span className="print-only">· {official.url}</span></p>}
    </li>
  );
}
