import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import Follow from "../components/Follow.jsx";
import { congressOn, congressYears } from "../../lib/congress.js";
import { billLabel, ordinal, partyTag, date } from "../lib/format.js";

const PAGE = 50;
const CURRENT = congressOn();
// Coverage starts with the 118th Congress.
const CONGRESS_OPTIONS = Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i);
const SORTS = {
  action: { label: "Most recent action", column: "latest_action_date" },
  referred: { label: "Most recently referred", column: "first_activity_date" },
  lobbying: { label: "Most organizations lobbying", column: "lobbying_clients" },
};

export default function Committee() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const congress = Number(params.get("congress")) || CURRENT;
  const sort = SORTS[params.get("sort")] ? params.get("sort") : "action";
  const [info, setInfo] = useState({ status: "loading" });
  const [bills, setBills] = useState({ status: "loading", rows: [] });
  const [shown, setShown] = useState(PAGE);
  const set = (k, v) => { const n = new URLSearchParams(params); n.set(k, v); setParams(n, { replace: true }); setShown(PAGE); };

  useEffect(() => {
    if (!/^[A-Z]{4}\d{0,2}$/.test(id ?? "")) { setInfo({ status: "missing" }); return; }
    (async () => {
      const [c, subs, mem, events] = await Promise.all([
        db.from("committees").select("committee_id,name,chamber,url,parent:parent_id(committee_id,name)").eq("committee_id", id).maybeSingle(),
        db.from("committees").select("committee_id,name").eq("parent_id", id).order("name"),
        db.from("committee_memberships").select("bioguide_id,side,rank,title,congress").eq("committee_id", id)
          .order("congress", { ascending: false }).order("side").order("rank"),
        db.from("upcoming_events").select("event_id,kind,event_date,event_time,committee_id,committee_name,title,status,source_url")
          .like("committee_id", `${id}%`).gte("event_date", new Date().toISOString().slice(0, 10)).order("event_date").limit(50),
      ]);
      if (c.error || !c.data) { setInfo({ status: c.error ? "error" : "missing" }); return; }
      const latest = mem.data?.[0]?.congress;
      const roster = (mem.data ?? []).filter((m) => m.congress === latest);
      const { data: people } = roster.length
        ? await db.from("member_directory").select("bioguide_id,name,party,chamber,state,district").in("bioguide_id", roster.map((r) => r.bioguide_id))
        : { data: [] };
      const byId = new Map((people ?? []).map((p) => [p.bioguide_id, p]));
      setInfo({ status: "done", committee: c.data, subs: subs.data ?? [], rosterCongress: latest, events: events.data ?? [],
        roster: roster.map((r) => ({ ...r, person: byId.get(r.bioguide_id) })) });
    })().catch(() => setInfo({ status: "error" }));
  }, [id]);

  useEffect(() => {
    setBills((b) => ({ ...b, status: "loading" }));
    db.from("committee_bills")
      .select("congress,bill_type,number,title,short_title,latest_action_date,latest_action_text,first_activity_date,sponsor_bioguide_id,sponsor_name,lobbying_clients", { count: "exact" })
      .eq("committee_id", id).eq("congress", congress)
      .order(SORTS[sort].column, { ascending: false, nullsFirst: false }).order("number").limit(1000)
      .then(({ data, error, count }) => setBills(error ? { status: "error", rows: [] } : { status: "done", rows: data, count }));
  }, [id, congress, sort]);

  if (info.status === "missing") return <main className="page"><h1>Committee not found</h1><p><Link to="/committees">All committees</Link></p></main>;
  if (info.status === "error") return <main className="page"><p className="notice">Couldn't load this committee right now.</p></main>;
  if (info.status === "loading") return <main className="page"><p>Loading…</p></main>;
  const { committee: c, subs, roster, rosterCongress, events } = info;
  const sides = ["majority", "minority"].map((s) => [s, roster.filter((r) => r.side === s)]).filter(([, l]) => l.length);
  const chamberName = { house: "House", senate: "Senate", joint: "Joint" }[c.chamber] ?? c.chamber;

  return (
    <main className="page wide">
      <p className="fine"><Link to="/committees">Committees</Link>{c.parent && <> · <Link to={`/committee/${c.parent.committee_id}`}>{c.parent.name}</Link></>}</p>
      <h1>{c.chamber === "joint" ? c.name : `${chamberName} ${c.name}`}</h1>
      {c.url && <p className="fine"><a href={c.url}>Committee website</a></p>}
      <Follow calendar={`/api/calendar/committee/${c.committee_id}`} />

      {events.length > 0 && (
        <section className="section">
          <h2>Coming up</h2>
          <ul className="plain">
            {events.map((e) => (
              <li key={e.event_id}>
                <strong>{date(e.event_date)}</strong>{e.event_time && <> {e.event_time} ET</>} · {e.kind === "markup" ? "Markup" : e.kind === "hearing" ? "Hearing" : "Meeting"}
                {e.committee_id !== c.committee_id && <> · {e.committee_name}</>}: <a href={e.source_url}>{e.title}</a>
                {e.status && e.status !== "Scheduled" && <strong> ({e.status})</strong>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {subs.length > 0 && (
        <section className="section">
          <h2>Subcommittees</h2>
          <ul className="plain columns">{subs.map((s) => <li key={s.committee_id}><Link to={`/committee/${s.committee_id}`}>{s.name}</Link></li>)}</ul>
        </section>
      )}

      <section className="section">
        <h2>Members{rosterCongress && ` (${ordinal(rosterCongress)} Congress)`}</h2>
        {sides.length === 0 ? <p>No membership on record.</p> : sides.map(([side, list]) => (
          <div key={side}>
            <h3 className="small">{side === "majority" ? "Majority" : "Minority"}</h3>
            <ul className="plain columns">
              {list.map((r) => (
                <li key={r.bioguide_id}>
                  <Link to={`/member/${r.bioguide_id}`}>{r.person?.name ?? r.bioguide_id}</Link>
                  {r.person && <> ({partyTag(r.person)})</>}{r.title && <span className="fine"> · {r.title}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="fine">Source: unitedstates/congress-legislators. Listed in committee rank order.</p>
      </section>

      <section className="section">
        <h2>Bills referred</h2>
        <div className="filters">
          <label>Congress{" "}
            <select value={congress} onChange={(e) => set("congress", e.target.value)}>
              {CONGRESS_OPTIONS.map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
            </select>
          </label>
          <label>Sort{" "}
            <select value={sort} onChange={(e) => set("sort", e.target.value)}>
              {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
            </select>
          </label>
        </div>
        {bills.status === "error" && <p className="notice">Couldn't load bills.</p>}
        {bills.status === "done" && <p>{(bills.count ?? bills.rows.length).toLocaleString()} bills referred in the {ordinal(congress)} Congress.</p>}
        {bills.rows.length > 0 && (
          <table className={bills.status === "loading" ? "dim" : ""}>
            <thead><tr><th>Bill</th><th>Referred</th><th>Latest action</th>{sort === "lobbying" && <th>Lobbying</th>}</tr></thead>
            <tbody>
              {bills.rows.slice(0, shown).map((b) => (
                <tr key={`${b.bill_type}-${b.number}`}>
                  <td><Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link> {b.short_title ?? b.title}
                    {b.sponsor_name && <div className="fine">Sponsor: <Link to={`/member/${b.sponsor_bioguide_id}`}>{b.sponsor_name}</Link></div>}</td>
                  <td className="fine">{date(b.first_activity_date)}</td>
                  <td><span className="fine">{date(b.latest_action_date)}</span><div>{b.latest_action_text}</div></td>
                  {sort === "lobbying" && <td>{b.lobbying_clients.toLocaleString()}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {bills.rows.length > shown && <p><button className="link" onClick={() => setShown(shown + PAGE)}>Show more</button></p>}
        {bills.count > bills.rows.length && <p className="fine">Showing the first 1,000.</p>}
        <p className="fine">Source: GovInfo Bill Status (Library of Congress). Includes bills referred to this committee or later handled by it.</p>
      </section>
    </main>
  );
}
