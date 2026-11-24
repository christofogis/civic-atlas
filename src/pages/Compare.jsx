import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { billLabel, ordinal, partyTag, date } from "../lib/format.js";
import { voteKind } from "../lib/voteKind.js";

const BIOGUIDE = /^[A-Z][0-9]{6}$/;
const pct = (n, d) => (d ? `${Math.round((1000 * n) / d) / 10}%` : "—");

function Picker({ label, value, members, onPick }) {
  const [text, setText] = useState("");
  const chosen = members.find((m) => m.bioguide_id === value);
  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    return t.length < 2 ? [] : members.filter((m) => m.name.toLowerCase().includes(t)).slice(0, 8);
  }, [text, members]);
  return (
    <div className="picker">
      <label>{label}{" "}
        <input type="search" value={text} placeholder={chosen ? chosen.name : "Type a name"} onChange={(e) => setText(e.target.value)} />
      </label>
      {chosen && !text && <div className="fine">{chosen.name} ({partyTag(chosen)}), {chosen.chamber === "senate" ? "Senate" : "House"}</div>}
      {matches.length > 0 && (
        <ul className="plain">
          {matches.map((m) => (
            <li key={m.bioguide_id}>
              <button className="link" onClick={() => { onPick(m.bioguide_id); setText(""); }}>{m.name}</button>{" "}
              <span className="fine">({partyTag(m)}){m.chamber === "senate" ? " · Senate" : " · House"}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const a = BIOGUIDE.test(params.get("a") ?? "") ? params.get("a") : "";
  const b = BIOGUIDE.test(params.get("b") ?? "") ? params.get("b") : "";
  const [members, setMembers] = useState([]);
  const [result, setResult] = useState({ status: "idle" });
  const [shown, setShown] = useState(50);
  const pick = (k, id) => { const n = new URLSearchParams(params); n.set(k, id); setParams(n, { replace: true }); };

  useEffect(() => {
    db.from("member_directory").select("bioguide_id,name,chamber,state,district,party,serving").order("last_name").limit(1000)
      .then(({ data }) => setMembers(data ?? []));
  }, []);

  useEffect(() => {
    if (!a || !b || a === b) { setResult({ status: "idle" }); return; }
    setResult({ status: "loading" });
    setShown(50);
    db.rpc("member_agreement", { a, b })
      .then(({ data, error }) => setResult(error ? { status: "error" } : { status: "done", ...data }));
  }, [a, b]);

  const ma = members.find((m) => m.bioguide_id === a);
  const mb = members.find((m) => m.bioguide_id === b);
  const short = (m) => m?.name.split(" ").slice(-1)[0] ?? "";

  return (
    <main className="page wide">
      <h1>Compare two members' votes</h1>
      <p className="lede">How often two members of the same chamber cast the same vote, and the roll calls where they differed.</p>
      <div className="filters">
        <Picker label="First member" value={a} members={members} onPick={(id) => pick("a", id)} />
        <Picker label="Second member" value={b} members={members} onPick={(id) => pick("b", id)} />
      </div>

      {a && b && a === b && <p className="notice">Pick two different members.</p>}
      {result.status === "loading" && <p>Comparing…</p>}
      {result.status === "error" && <p className="notice">Couldn't compare right now. Try again shortly.</p>}
      {result.status === "done" && (
        result.by_congress.length === 0
          ? <p className="notice">These two members haven't voted on any of the same roll calls since 2023. Members can only be compared within the same chamber.</p>
          : (
            <>
              <section className="section">
                <h2>{ma?.name} and {mb?.name}</h2>
                <table>
                  <thead><tr><th>Congress</th><th>Both voted Yea or Nay</th><th>Same vote</th><th>Different vote</th></tr></thead>
                  <tbody>
                    {result.by_congress.map((c) => (
                      <tr key={`${c.congress}-${c.chamber}`}>
                        <td>{ordinal(c.congress)} ({c.chamber === "senate" ? "Senate" : "House"})</td>
                        <td>{c.both_voted.toLocaleString()} of {c.shared_roll_calls.toLocaleString()} roll calls</td>
                        <td>{c.same.toLocaleString()} ({pct(c.same, c.both_voted)})</td>
                        <td>{c.different.toLocaleString()} ({pct(c.different, c.both_voted)})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="fine">
                  Counts every roll call where both voted Yea or Nay, including procedural votes. Votes where either was
                  absent or voted Present aren't counted. <Link to="/methods#compare">More on this comparison</Link>.
                </p>
              </section>
              <section className="section">
                <h2>Votes where they differed</h2>
                {result.differed.length === 0 ? <p>None.</p> : (
                  <>
                    <table>
                      <thead><tr><th>Date</th><th>Question</th><th>{short(ma)}</th><th>{short(mb)}</th></tr></thead>
                      <tbody>
                        {result.differed.slice(0, shown).map((v) => {
                          const k = voteKind(v);
                          return (
                            <tr key={v.vote_id}>
                              <td>{date(v.voted_at)}</td>
                              <td>
                                <span className={`kind kind-${k.kind}`} title={k.explain}>{k.label}</span>
                                <a href={v.source_url}>{v.question}</a>
                                <div className="fine">
                                  {v.bill_type ? <Link to={`/bill/${v.bill_congress}/${v.bill_type}/${v.bill_number}`}>{billLabel({ bill_type: v.bill_type, number: v.bill_number })}</Link> : v.description}
                                  {" · "}{v.result}
                                </div>
                              </td>
                              <td>{v.a_position}</td>
                              <td>{v.b_position}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {result.differed.length > shown && (
                      <p><button className="link" onClick={() => setShown(shown + 50)}>Show more</button></p>
                    )}
                    {result.differed.length === 500 && <p className="fine">Showing the 500 most recent.</p>}
                  </>
                )}
              </section>
            </>
          )
      )}
    </main>
  );
}
