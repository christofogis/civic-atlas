import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import DownloadCsv from "../components/DownloadCsv.jsx";
import { KindLabel } from "../components/Explain.jsx";
import { billLabel, ordinal, partyTag, date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { PartyTag } from "../components/PartyTag.jsx";

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
        <input type="search" value={text} placeholder={chosen ? chosen.name : tr("Type a name", "Escriba un nombre")} onChange={(e) => setText(e.target.value)} />
      </label>
      {chosen && !text && <div className="fine">{chosen.name} <PartyTag p={chosen} />, {chosen.chamber === "senate" ? tr("Senate", "Senado") : tr("House", "Cámara")}</div>}
      {matches.length > 0 && (
        <ul className="plain">
          {matches.map((m) => (
            <li key={m.bioguide_id}>
              <button className="link" onClick={() => { onPick(m.bioguide_id); setText(""); }}>{m.name}</button>{" "}
              <span className="fine"><PartyTag p={m} />{m.chamber === "senate" ? tr(" · Senate", " · Senado") : tr(" · House", " · Cámara")}</span>
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
      <h1>{tr("Compare two members' votes", "Comparar los votos de dos miembros")}</h1>
      <p className="lede">{tr("How often two members of the same chamber cast the same vote, and the roll calls where they differed.", "Con qué frecuencia dos miembros de la misma cámara votaron igual, y las votaciones en que votaron distinto.")}</p>
      <div className="filters">
        <Picker label={tr("First member", "Primer miembro")} value={a} members={members} onPick={(id) => pick("a", id)} />
        <Picker label={tr("Second member", "Segundo miembro")} value={b} members={members} onPick={(id) => pick("b", id)} />
      </div>

      {a && b && a === b && <p className="notice">{tr("Pick two different members.", "Elija dos miembros distintos.")}</p>}
      {result.status === "loading" && <p>{tr("Comparing…", "Comparando…")}</p>}
      {result.status === "error" && <p className="notice">{tr("Couldn't compare right now. Try again shortly.", "No se pudo comparar en este momento. Inténtelo en un momento.")}</p>}
      {result.status === "done" && (
        result.by_congress.length === 0
          ? <p className="notice">{tr("These two members haven't voted on any of the same roll calls since 2023. Members can only be compared within the same chamber.", "Estos dos miembros no han votado en las mismas votaciones desde 2023. Solo se pueden comparar miembros de la misma cámara.")}</p>
          : (
            <>
              <section className="section">
                <h2>{ma?.name} {tr("and", "y")} {mb?.name}</h2>
                <table>
                  <thead><tr><th>{tr("Congress", "Congreso")}</th><th>{tr("Both voted Yea or Nay", "Ambos votaron sí o no")}</th><th>{tr("Same vote", "Mismo voto")}</th><th>{tr("Different vote", "Voto distinto")}</th></tr></thead>
                  <tbody>
                    {result.by_congress.map((c) => (
                      <tr key={`${c.congress}-${c.chamber}`}>
                        <td>{ordinal(c.congress)} ({c.chamber === "senate" ? tr("Senate", "Senado") : tr("House", "Cámara")})</td>
                        <td>{tr(`${c.both_voted.toLocaleString()} of ${c.shared_roll_calls.toLocaleString()} roll calls`, `${c.both_voted.toLocaleString()} de ${c.shared_roll_calls.toLocaleString()} votaciones`)}</td>
                        <td>{c.same.toLocaleString()} ({pct(c.same, c.both_voted)})</td>
                        <td>{c.different.toLocaleString()} ({pct(c.different, c.both_voted)})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="fine">
                  {tr("Counts every roll call where both voted Yea or Nay, including procedural votes. Votes where either was absent or voted Present aren't counted.", "Cuenta cada votación en que ambos votaron sí (Yea) o no (Nay), incluidas las de procedimiento. No se cuentan las votaciones en que alguno estuvo ausente o votó Present.")}{" "}
                  <Link to="/methods#compare">{tr("More on this comparison", "Más sobre esta comparación")}</Link>.
                </p>
              </section>
              <section className="section">
                <h2>{tr("Votes where they differed", "Votaciones en que votaron distinto")}</h2>
                {result.differed.length === 0 ? <p>{tr("None.", "Ninguna.")}</p> : (
                  <>
                    <table>
                      <thead><tr><th>{tr("Date", "Fecha")}</th><th>{tr("Question", "Asunto")}</th><th>{short(ma)}</th><th>{short(mb)}</th></tr></thead>
                      <tbody>
                        {result.differed.slice(0, shown).map((v) => {
                          return (
                            <tr key={v.vote_id}>
                              <td>{date(v.voted_at)}</td>
                              <td>
                                <KindLabel v={v} />
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
                    <DownloadCsv rows={result.differed} filename={`votes-differed-${a}-${b}`} columns={[
                      ["Date", (v) => v.voted_at?.slice(0, 10)], ["Chamber", (v) => v.chamber], ["Question", (v) => v.question],
                      ["Bill", (v) => (v.bill_type ? `${v.bill_type.toUpperCase()} ${v.bill_number}` : "")], ["Result", (v) => v.result],
                      [ma?.name ?? a, (v) => v.a_position], [mb?.name ?? b, (v) => v.b_position], ["Source", (v) => v.source_url],
                    ]} />
                    {result.differed.length > shown && (
                      <p><button className="link" onClick={() => setShown(shown + 50)}>{tr("Show more", "Mostrar más")}</button></p>
                    )}
                    {result.differed.length === 500 && <p className="fine">{tr("Showing the 500 most recent.", "Se muestran las 500 más recientes.")}</p>}
                  </>
                )}
              </section>
            </>
          )
      )}
    </main>
  );
}
