import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { ordinal } from "../lib/format.js";
import { findMembers, findBills } from "../../lib/explain.js";
import { congressOn } from "../../lib/congress.js";

const CURRENT = congressOn();
const MAX_CHARS = 100_000;

// Paste a news story; see which members of Congress and bills it names, linked to their records.
// Matching runs entirely in the browser. The text is never sent to our server or stored.
export default function ExplainStory() {
  const [text, setText] = useState("");
  const [members, setMembers] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db.from("member_directory").select("bioguide_id,name,first_name,last_name,nickname,chamber,state,district,party,serving").limit(2000)
      .then(({ data }) => setMembers(data ?? []));
  }, []);

  const run = async (e) => {
    e.preventDefault();
    const t = text.slice(0, MAX_CHARS);
    setBusy(true);
    const people = findMembers(t, members ?? []).sort((a, z) => Number(z.serving) - Number(a.serving) || a.last_name.localeCompare(z.last_name));
    const refs = findBills(t).slice(0, 40);
    let bills = [];
    if (refs.length) {
      // A story rarely says which Congress; look in the current one, then the one before.
      const or = refs.map((r) => `and(bill_type.eq.${r.bill_type},number.eq.${r.number})`).join(",");
      const { data } = await db.from("bills").select("congress,bill_type,number,short_title,title,latest_action_text")
        .in("congress", [CURRENT, CURRENT - 1]).or(or);
      for (const r of refs) {
        const match = (data ?? []).filter((b) => b.bill_type === r.bill_type && b.number === r.number).sort((a, z) => z.congress - a.congress);
        bills.push({ ref: r, matches: match });
      }
    }
    setResult({ people, bills });
    setBusy(false);
  };

  const label = (r) => `${{ hr: "H.R.", s: "S.", hres: "H.Res.", sres: "S.Res.", hjres: "H.J.Res.", sjres: "S.J.Res.", hconres: "H.Con.Res.", sconres: "S.Con.Res." }[r.bill_type]} ${r.number}`;

  return (
    <main className="page">
      <h1>Look up a news story</h1>
      <p className="lede">
        Paste the text of an article. We'll list the members of Congress and the bills it names, with links to their
        votes, bills and money, so you can check the record yourself.
      </p>
      <form onSubmit={run}>
        <label htmlFor="story" className="fine">Article text</label>
        <textarea id="story" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the article here" style={{ width: "100%" }} />
        <p>
          <button type="submit" disabled={!text.trim() || !members || busy}>{busy ? "Looking…" : "Find people and bills"}</button>
          {text && <> <button type="button" className="link" onClick={() => { setText(""); setResult(null); }}>Clear</button></>}
        </p>
        <p className="fine">
          This runs in your browser. The text isn't sent to us or saved. We match full names, or a title and last name
          ("Sen. Padilla") when only one member of that chamber has that last name, so some mentions may be missed.
        </p>
      </form>
      {result && (
        <>
          <h2>Members of Congress named</h2>
          {result.people.length === 0 ? <p>None found.</p> : (
            <ul className="plain">
              {result.people.map((m) => (
                <li key={m.bioguide_id}>
                  <Link to={`/member/${m.bioguide_id}`}>{m.name}</Link>{" "}
                  <span className="fine">
                    {m.party?.[0]}-{m.state}{m.chamber === "house" && m.district != null ? `-${m.district}` : ""} · {m.chamber === "senate" ? "Senate" : "House"}{m.serving ? "" : " · former member"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h2>Bills named</h2>
          {result.bills.length === 0 ? <p>None found. Stories often name a bill by its title instead; try <Link to="/search">search</Link>.</p> : (
            <ul className="plain">
              {result.bills.map(({ ref, matches }) => (
                <li key={`${ref.bill_type}${ref.number}`}>
                  {matches.length === 0 ? <>{label(ref)} <span className="fine">· not found in the {ordinal(CURRENT)} or {ordinal(CURRENT - 1)} Congress</span></> : matches.map((b) => (
                    <div key={b.congress}>
                      <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{label(ref)}</Link> <span className="fine">({ordinal(b.congress)} Congress)</span>{" "}
                      {b.short_title ?? b.title}
                      {b.latest_action_text && <div className="fine">Latest action: {b.latest_action_text}</div>}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {result.bills.some((b) => b.matches.length > 1) && <p className="fine">Bill numbers restart each Congress, so a number can match a bill in each. Check which one the story means.</p>}
        </>
      )}
    </main>
  );
}
