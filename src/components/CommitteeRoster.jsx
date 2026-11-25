import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { tr } from "../lib/lang.js";
import { myRepresentatives } from "../lib/myReps.js";
import { PartyTag } from "./PartyTag.jsx";

const PREVIEW = 6;   // per side, before "show all"

// Members of a committee (or subcommittee) in a given Congress, majority and minority side by side
// in committee rank order, leaders first. A roster, not attendance: the meeting record doesn't say
// who attended.
// committeeIds: tried in order (a subcommittee first, then its full committee) until one has a roster.
export default function CommitteeRoster({ committeeIds = [], congress }) {
  const [rows, setRows] = useState(null);
  const [all, setAll] = useState(false);
  const mine = useMemo(() => myRepresentatives(), []);

  useEffect(() => {
    if (!committeeIds.length) return;
    (async () => {
      // The meeting's Congress if its roster is on file, otherwise the latest one.
      let mem = [];
      for (const id of committeeIds) {
        const { data } = await db.from("committee_memberships").select("bioguide_id,side,rank,title,congress")
          .eq("committee_id", id).order("congress", { ascending: false }).order("rank");
        if (data?.length) { mem = data; break; }
      }
      const congresses = [...new Set((mem ?? []).map((r) => r.congress))];
      const use = congresses.includes(congress) ? congress : congresses[0];
      const roster = (mem ?? []).filter((r) => r.congress === use);
      const { data: people } = roster.length
        ? await db.from("member_directory").select("bioguide_id,name,party,chamber,state,district").in("bioguide_id", roster.map((r) => r.bioguide_id))
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.bioguide_id, p]));
      setRows({ congress: use, list: roster.map((r) => ({ ...r, person: byId.get(r.bioguide_id) })).filter((r) => r.person) });
    })().catch(() => setRows({ list: [] }));
  }, [committeeIds.join(","), congress]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!rows || rows.list.length === 0) return null;
  const sides = ["majority", "minority"].map((s) => [s, rows.list.filter((r) => r.side === s)]).filter(([, l]) => l.length);
  const longest = Math.max(...sides.map(([, l]) => l.length));
  const mineHere = rows.list.filter((r) => mine.has(r.bioguide_id));

  return (
    <section className="section">
      <h2>{tr("Committee members", "Miembros del comité")} <span className="fine">({rows.list.length})</span></h2>
      {mineHere.length > 0 && (
        <p className="mine-note">{tr("Your representative on this committee:", "Su representante en este comité:")}{" "}
          {mineHere.map((r, i) => <span key={r.bioguide_id}>{i ? ", " : ""}<Link to={`/member/${r.bioguide_id}`}>{r.person.name}</Link></span>)}</p>
      )}
      <div className="roster">
        {sides.map(([side, list]) => (
          <div key={side}>
            <h3 className="small">{side === "majority" ? tr("Majority", "Mayoría") : tr("Minority", "Minoría")}</h3>
            <ul className="bare">
              {(all ? list : list.slice(0, PREVIEW)).map((r) => (
                <li key={r.bioguide_id} className={mine.has(r.bioguide_id) ? "mine-row" : ""}>
                  <Link to={`/member/${r.bioguide_id}`}>{r.person.name}</Link> <PartyTag p={r.person} />
                  {r.title && <span className="fine"> · {r.title}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {longest > PREVIEW && (
        <button type="button" className="link fine" onClick={() => setAll(!all)}>
          {all ? tr("Show fewer", "Mostrar menos") : tr(`Show all ${rows.list.length}`, `Mostrar los ${rows.list.length}`)}
        </button>
      )}
      <p className="fine">
        {tr("Everyone who sits on the committee, in committee rank order. The meeting record doesn't say who attended; the video does.",
          "Todos los que forman parte del comité, en el orden de rango del comité. El registro de la reunión no dice quién asistió; el video sí.")}
        {" "}{tr("Source: unitedstates/congress-legislators.", "Fuente: unitedstates/congress-legislators.")}
      </p>
    </section>
  );
}
