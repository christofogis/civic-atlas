import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { ordinal } from "../lib/format.js";
import { findMembers, findBills } from "../../lib/explain.js";
import { congressOn } from "../../lib/congress.js";
import { tr } from "../lib/lang.js";
import { PartyTag } from "../components/PartyTag.jsx";

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
      <h1>{tr("Look up a news story", "Buscar una noticia")}</h1>
      <p className="lede">
        {tr("Paste the text of an article. We'll list the members of Congress and the bills it names, with links to their votes, bills and money, so you can check the record yourself.",
          "Pegue el texto de un artículo. Le mostraremos los miembros del Congreso y los proyectos de ley que menciona, con enlaces a sus votos, proyectos y dinero, para que revise el registro usted mismo.")}
      </p>
      <form onSubmit={run}>
        <label htmlFor="story" className="fine">{tr("Article text", "Texto del artículo")}</label>
        <textarea id="story" rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("Paste the article here", "Pegue el artículo aquí")} style={{ width: "100%" }} />
        <p>
          <button type="submit" disabled={!text.trim() || !members || busy}>{busy ? tr("Looking…", "Buscando…") : tr("Find people and bills", "Encontrar personas y proyectos")}</button>
          {text && <> <button type="button" className="link" onClick={() => { setText(""); setResult(null); }}>{tr("Clear", "Borrar")}</button></>}
        </p>
        <p className="fine">
          {tr(`This runs in your browser. The text isn't sent to us or saved. We match full names, or a title and last name ("Sen. Padilla") when only one member of that chamber has that last name, so some mentions may be missed.`,
            `Esto funciona en su navegador. El texto no se nos envía ni se guarda. Reconocemos nombres completos, o un título y apellido en inglés ("Sen. Padilla") cuando solo un miembro de esa cámara tiene ese apellido, así que algunas menciones pueden pasarse por alto.`)}
        </p>
      </form>
      <p role="status" className="visually-hidden">
        {result ? tr(`Found ${result.people.length} member${result.people.length === 1 ? "" : "s"} and ${result.bills.length} bill number${result.bills.length === 1 ? "" : "s"}.`, `Se encontraron ${result.people.length} miembro${result.people.length === 1 ? "" : "s"} y ${result.bills.length} número${result.bills.length === 1 ? "" : "s"} de proyecto.`) : ""}
      </p>
      {result && (
        <>
          <h2>{tr("Members of Congress named", "Miembros del Congreso mencionados")}</h2>
          {result.people.length === 0 ? <p>{tr("None found.", "No se encontró ninguno.")}</p> : (
            <ul className="plain">
              {result.people.map((m) => (
                <li key={m.bioguide_id}>
                  <Link to={`/member/${m.bioguide_id}`}>{m.name}</Link>{" "}
                  <PartyTag p={m} />{" "}
                  <span className="fine">
                    {m.chamber === "senate" ? tr("Senate", "Senado") : tr("House", "Cámara")}{m.serving ? "" : tr(" · former member", " · exmiembro")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h2>{tr("Bills named", "Proyectos mencionados")}</h2>
          {result.bills.length === 0 ? <p>{tr("None found. Stories often name a bill by its title instead; try ", "No se encontró ninguno. Las noticias suelen nombrar un proyecto por su título; pruebe la ")}<Link to="/search">{tr("search", "búsqueda")}</Link>.</p> : (
            <ul className="plain">
              {result.bills.map(({ ref, matches }) => (
                <li key={`${ref.bill_type}${ref.number}`}>
                  {matches.length === 0 ? <>{label(ref)} <span className="fine">· {tr(`not found in the ${ordinal(CURRENT)} or ${ordinal(CURRENT - 1)} Congress`, `no se encontró en el ${ordinal(CURRENT)} ni en el ${ordinal(CURRENT - 1)} Congreso`)}</span></> : matches.map((b) => (
                    <div key={b.congress}>
                      <Link to={`/bill/${b.congress}/${b.bill_type}/${b.number}`}>{label(ref)}</Link> <span className="fine">({ordinal(b.congress)} {tr("Congress", "Congreso")})</span>{" "}
                      {b.short_title ?? b.title}
                      {b.latest_action_text && <div className="fine">{tr("Latest action", "Última acción")}: {b.latest_action_text}</div>}
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {result.bills.some((b) => b.matches.length > 1) && <p className="fine">{tr("Bill numbers restart each Congress, so a number can match a bill in each. Check which one the story means.", "Los números de proyecto se reinician en cada Congreso, así que un número puede coincidir con un proyecto en cada uno. Verifique a cuál se refiere la noticia.")}</p>}
        </>
      )}
    </main>
  );
}
