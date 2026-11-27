import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { searchMembers } from "../lib/members.js";
import { billLabel, ordinal, partyTag, date } from "../lib/format.js";
import { extractBillRefs } from "../../lib/billrefs.js";
import { tr } from "../lib/lang.js";
import { PartyTag } from "../components/PartyTag.jsx";
import Clamp from "../components/Clamp.jsx";
import { PlainLead } from "../components/PlainSummary.jsx";
import { usePlainSummaries } from "../lib/plainSummaries.js";

const BILL_COLUMNS = "congress,bill_type,number,title,short_title,latest_action_date,policy_area,sponsor_name";

async function searchBills(q) {
  const refs = extractBillRefs(q);
  if (refs.length) {
    const found = await Promise.all(refs.slice(0, 5).map(async (r) => {
      const { data, error } = await db.from("bill_list").select(BILL_COLUMNS)
        .eq("bill_type", r.bill_type).eq("number", r.number).order("congress", { ascending: false });
      if (error) throw error;
      return data;
    }));
    return { byNumber: true, bills: found.flat() };
  }
  // "Bill", "act" and "resolution" rarely help ("farm bill" should find the Farm, Food, and
  // National Security Act), and official House titles don't contain them.
  const words = q.replace(/\b(bills?|acts?|resolutions?)\b/gi, " ").trim();
  if (words.length < 3) return { byNumber: false, bills: [] };
  const { data, error } = await db.from("bill_list").select(BILL_COLUMNS)
    .textSearch("search", words, { type: "websearch", config: "english" })
    .order("latest_action_date", { ascending: false, nullsFirst: false }).limit(30);
  if (error) throw error;
  return { byNumber: false, bills: data };
}

export default function Search() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [state, setState] = useState({ status: "idle" });
  const plain = usePlainSummaries(state.bills ?? []);

  useEffect(() => {
    setInput(q);
    if (!q.trim()) { setState({ status: "idle" }); return; }
    setState({ status: "loading" });
    Promise.all([searchMembers(q), searchBills(q)])
      .then(([members, bills]) => setState({ status: "done", members, ...bills }))
      .catch(() => setState({ status: "error" }));
  }, [q]);

  return (
    <main className="page">
      <h1>{tr("Search", "Buscar")}</h1>
      <form className="lookup" role="search" onSubmit={(e) => { e.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}); }}>
        <label htmlFor="q">{tr("Member name, bill number or words from a bill's title", "Nombre de un miembro, número de proyecto o palabras del título (los títulos están en inglés)")}</label>
        <div className="row">
          <input id="q" type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Padilla, H.R. 1, farm bill" />
          <button type="submit">{tr("Search", "Buscar")}</button>
        </div>
      </form>

      {state.status === "loading" && <p>{tr("Searching…", "Buscando…")}</p>}
      {state.status === "error" && <p className="notice">{tr("Search isn't working right now. Try again shortly.", "La búsqueda no funciona en este momento. Inténtelo de nuevo en un momento.")}</p>}
      {state.status === "done" && (
        <>
          <section className="section">
            <h2>{tr("Members", "Miembros")}</h2>
            {state.members.length === 0 ? <p className="fine">{tr("No members match.", "Ningún miembro coincide.")}</p> : (
              <ul className="plain">
                {state.members.map((m) => (
                  <li key={m.bioguide_id}>
                    <Link to={`/member/${m.bioguide_id}`}>{m.name}</Link> <PartyTag p={m} />{" "}
                    <span className="fine">{m.chamber === "senate" ? tr("Senate", "Senado") : tr("House", "Cámara")}{m.serving ? "" : tr(`, served until ${date(m.end_date)}`, `, en el cargo hasta el ${date(m.end_date)}`)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="section">
            <h2>{tr("Bills", "Proyectos de ley")}</h2>
            {state.bills.length === 0 ? <p className="fine">{state.byNumber ? tr("No bills match that number since the 118th Congress (2023).", "Ningún proyecto coincide con ese número desde el 118.º Congreso (2023).") : tr("No bills match.", "Ningún proyecto coincide.")}</p> : (
              <ul className="plain">
                {state.bills.map((b) => (
                  <li key={`${b.congress}-${b.bill_type}-${b.number}`}>
                    <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{billLabel(b)}</Link>{" "}
                    <span className="fine">({ordinal(b.congress)})</span> <Clamp lines={2}>{b.short_title ?? b.title}</Clamp>
                    <PlainLead map={plain} bill={b} />
                    <div className="fine">{[b.sponsor_name && `${tr("Sponsor", "Patrocinador")}: ${b.sponsor_name}`, b.policy_area, b.latest_action_date && `${tr("Latest action", "Última acción")} ${date(b.latest_action_date)}`].filter(Boolean).join(" · ")}</div>
                  </li>
                ))}
              </ul>
            )}
            {!state.byNumber && state.bills.length === 30 && <p className="fine">{tr("Showing the 30 with the most recent action. Add words to narrow the search.", "Se muestran los 30 con la acción más reciente. Agregue palabras para afinar la búsqueda.")}</p>}
          </section>
        </>
      )}
    </main>
  );
}
