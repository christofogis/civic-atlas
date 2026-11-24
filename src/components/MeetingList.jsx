import { Link } from "react-router-dom";
import { date } from "../lib/format.js";
import { meetingHeading } from "../../lib/meetings.js";

export const meetingTime = (m) => m.meeting_at
  ? `${date(m.meeting_at)}, ${new Date(m.meeting_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET`
  : "Date not set";

// Committee meetings as a list linking to their pages.
export default function MeetingList({ meetings, showCommittee = false, committees = {} }) {
  return (
    <ul className="plain meetings">
      {meetings.map((m) => (
        <li key={m.event_id}>
          <span className="fine">{meetingTime(m)}{m.meeting_type && <> · {m.meeting_type}</>}
            {m.status && !/^scheduled$/i.test(m.status) && <strong> · {m.status}</strong>}
            {showCommittee && m.committee_ids?.[0] && <> · {committees[m.committee_ids[0]] ?? m.committee_ids[0]}</>}</span>
          <div><Link to={`/hearing/${m.event_id}`}>{meetingHeading(m.title, m.meeting_type).heading}</Link></div>
        </li>
      ))}
    </ul>
  );
}
