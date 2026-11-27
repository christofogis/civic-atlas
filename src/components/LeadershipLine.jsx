import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { currentRoles } from "../../lib/leadership.js";

// One short line with a member's current leadership posts, e.g. "Senate Majority Leader since
// Jan 3, 2025" (title as published), the same wording for everyone. Nothing when there are none.
export default function LeadershipLine({ bioguideId, className = "member-meta" }) {
  const [roles, setRoles] = useState([]);
  useEffect(() => {
    let live = true;
    setRoles([]);
    db.from("leadership_roles").select("bioguide_id,chamber,title,start_date,end_date").eq("bioguide_id", bioguideId)
      .then(({ data, error }) => { if (live && !error) setRoles(currentRoles(data, undefined, bioguideId)); });
    return () => { live = false; };
  }, [bioguideId]);
  if (!roles.length) return null;
  return (
    <p className={`${className} leadership-line`}>
      {roles.map((r, i) => (
        <span key={`${r.title}-${r.start_date}`}>{i ? "; " : ""}<Link to="/leadership">{r.title}</Link> {tr(`since ${date(r.start_date)}`, `desde el ${date(r.start_date)}`)}</span>
      ))}
    </p>
  );
}
