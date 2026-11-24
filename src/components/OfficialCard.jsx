import { Link } from "react-router-dom";
import { seatLabel, date } from "../lib/format.js";

// One official in the lookup results. Identical layout for every party.
export default function OfficialCard({ official }) {
  if (official.seat_status === "pending_update") {
    return (
      <li className="card pending">
        <p className="seat">{seatLabel(official)}</p>
        <p>A new term began on {date(official.end_date)}. Information for this seat is being updated.</p>
      </li>
    );
  }
  return (
    <li className="card">
      <p className="seat">{seatLabel(official)}</p>
      <h3><Link to={`/member/${official.bioguide_id}`}>{official.name}</Link></h3>
      <p className="meta">{official.party} · Serving since {date(official.start_date)}</p>
    </li>
  );
}
