import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { partyTag, date } from "../lib/format.js";
import { forgetRepresentatives } from "../lib/myReps.js";

// The home page for a returning visitor: their representatives, the latest vote each cast,
// and how many hearings their committees have coming up.
export default function MyReps({ ids, onForget }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    const list = [...ids];
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      db.from("member_directory").select("bioguide_id,name,chamber,state,district,party,serving").in("bioguide_id", list),
      ...list.map((id) => db.from("member_votes").select("bioguide_id,position,question,voted_at,bill_congress,bill_type,bill_number,bill_title")
        .eq("bioguide_id", id).order("voted_at", { ascending: false }).limit(1)),
      db.from("committee_memberships").select("bioguide_id,committee_id,congress").in("bioguide_id", list),
    ]).then(async (res) => {
      const people = res[0].data ?? [];
      const latest = Object.fromEntries(res.slice(1, 1 + list.length).map((r) => [r.data?.[0]?.bioguide_id, r.data?.[0]]));
      const cm = res[1 + list.length].data ?? [];
      const top = Math.max(0, ...cm.map((c) => c.congress));
      const committees = [...new Set(cm.filter((c) => c.congress === top).map((c) => c.committee_id))];
      const { count } = committees.length
        ? await db.from("upcoming_events").select("*", { count: "exact", head: true }).in("committee_id", committees).gte("event_date", today)
        : { count: 0 };
      const order = { senate: 0, house: 1 };
      setRows({ people: people.sort((a, z) => order[a.chamber] - order[z.chamber]), latest, hearings: count ?? 0 });
    }).catch(() => setRows({ people: [], latest: {}, hearings: 0 }));
  }, [ids]);

  if (!rows) return <p>Loading your representatives…</p>;
  if (rows.people.length === 0) return null;
  return (
    <section className="my-reps">
      <h2>Your representatives</h2>
      <ul className="plain">
        {rows.people.map((p) => {
          const v = rows.latest[p.bioguide_id];
          return (
            <li key={p.bioguide_id}>
              <Link to={`/member/${p.bioguide_id}`} className="my-rep-name">{p.name}</Link> <span className="fine">{p.chamber === "senate" ? "Senator" : p.district > 0 || p.district === 0 ? "Representative" : ""} ({partyTag(p)})</span>
              {v && (
                <div className="fine">
                  Latest vote, {date(v.voted_at)}: <strong>{v.position}</strong> on {v.bill_type
                    ? <Link to={`/bill/${v.bill_congress}/${v.bill_type}/${v.bill_number}`}>{v.bill_title ?? v.question}</Link>
                    : v.question}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p>
        <Link to="/week">This week in Congress</Link>
        {rows.hearings > 0 && <> · their committees have {rows.hearings} hearing{rows.hearings === 1 ? "" : "s"} or markup{rows.hearings === 1 ? "" : "s"} coming up</>}
        {" · "}<Link to="/quiz">Do you vote like them?</Link>
      </p>
      <p className="fine">
        Remembered on this device from your last lookup (member IDs only, never your address).{" "}
        <button type="button" className="link fine" onClick={() => { forgetRepresentatives(); onForget(); }}>Forget them</button>
      </p>
    </section>
  );
}
