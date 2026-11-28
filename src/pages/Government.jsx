import { NotesList, Ref } from "../components/Notes.jsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { date, partyName } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { partyClass } from "../components/PartyTag.jsx";
import { Capitol, WhiteHouse, SupremeCourt } from "../components/BranchDrawing.jsx";

// The three branches of the federal government: what each does under the Constitution, who
// serves now, and recent official actions. Facts only; each section links to its source.
const TERRITORIES = new Set(["DC", "PR", "GU", "VI", "AS", "MP"]);
const today = new Date().toISOString().slice(0, 10);

function PartyCounts({ rows }) {
  const counts = {};
  rows.forEach((r) => { counts[r.party ?? "Other"] = (counts[r.party ?? "Other"] ?? 0) + 1; });
  const order = Object.entries(counts).sort((a, z) => z[1] - a[1]);
  return (
    <span className="party-counts">
      {order.map(([party, n]) => <span key={party}><span className={partyClass(party)}>{party[0]}</span> {n} {partyName(party)}</span>)}
    </span>
  );
}

export default function Government() {
  const [members, setMembers] = useState([]);
  const [exec, setExec] = useState([]);
  const [orders, setOrders] = useState([]);
  const [orderCount, setOrderCount] = useState(null);
  const [court, setCourt] = useState(null);

  useEffect(() => {
    document.title = tr("Three branches of government · Civic Atlas", "Los tres poderes del gobierno · Civic Atlas");
    db.from("member_directory").select("chamber,state,party").eq("serving", true).then(({ data }) => setMembers(data ?? []));
    db.from("executive_terms").select("name,type,start_date,end_date,party,bioguide_id").lte("start_date", today).gte("end_date", today)
      .then(({ data }) => setExec(data ?? []));
    db.from("executive_orders").select("document_number,eo_number,title,signing_date,president,citation,html_url").order("signing_date", { ascending: false }).order("eo_number", { ascending: false }).limit(5)
      .then(({ data }) => setOrders(data ?? []));
    fetch("/data/justices.json").then((r) => r.json()).then(setCourt).catch(() => {});
  }, []);

  const president = exec.find((e) => e.type === "prez");
  const vp = exec.find((e) => e.type === "viceprez");
  useEffect(() => {
    if (!president) return;
    db.from("executive_orders").select("document_number", { count: "exact", head: true }).gte("signing_date", president.start_date)
      .then(({ count }) => setOrderCount(count));
  }, [president]);

  const senate = members.filter((m) => m.chamber === "senate");
  const house = members.filter((m) => m.chamber === "house" && !TERRITORIES.has(m.state));
  const delegates = members.filter((m) => m.chamber === "house" && TERRITORIES.has(m.state));

  return (
    <main className="page wide government">
      <h1>{tr("Three branches of government", "Los tres poderes del gobierno")}<Ref id="src" text={<>{tr("Sources: members of Congress, the President and Vice President from unitedstates/congress-legislators; executive orders from the Federal Register; justices from the Supreme Court's website. Party letters: D Democrat, R Republican, I Independent.",
          "Fuentes: miembros del Congreso, el Presidente y el Vicepresidente de unitedstates/congress-legislators; órdenes ejecutivas del Registro Federal; magistrados del sitio web de la Corte Suprema. Letras de partido: D Demócrata, R Republicano, I Independiente.")}</>} /></h1>
      <p className="lede">
        {tr("The Constitution divides the federal government into three branches. Congress writes the laws, the President carries them out, and the courts decide what they mean. Each branch has powers that check the others.",
          "La Constitución divide el gobierno federal en tres poderes. El Congreso redacta las leyes, el Presidente las ejecuta y los tribunales deciden qué significan. Cada poder tiene facultades que limitan a los otros.")}{" "}
        <Link to="/constitution">{tr("Read the Constitution, part by part", "Lea la Constitución, parte por parte")}</Link>
      </p>

      <div className="branches">
        <section className="branch" aria-labelledby="b-leg">
          <Capitol />
          <h2 id="b-leg">{tr("Legislative branch", "Poder legislativo")}</h2>
          <p className="fine">{tr("Congress · ", "El Congreso · ")}<Link to="/constitution#art1-s1">{tr("Article I of the Constitution", "Artículo I de la Constitución")}</Link></p>
          <p>{tr("Writes and passes federal laws, sets taxes and spending, and can declare war. The Senate also confirms the President's nominees and approves treaties.",
            "Redacta y aprueba las leyes federales, fija los impuestos y el gasto, y puede declarar la guerra. El Senado además confirma a los nominados del Presidente y aprueba los tratados.")}</p>
          <h3 className="small">{tr("Who serves now", "Quiénes sirven ahora")}</h3>
          <p>{tr(`Senate: 100 senators, two per state${senate.length && senate.length < 100 ? ` (${100 - senate.length} vacant)` : ""}.`, `Senado: 100 senadores, dos por estado${senate.length && senate.length < 100 ? ` (${100 - senate.length} vacantes)` : ""}.`)}<br /><PartyCounts rows={senate} /></p>
          <p>{tr(`House: 435 voting representatives, one per district${house.length && house.length < 435 ? ` (${435 - house.length} seat${435 - house.length === 1 ? "" : "s"} vacant)` : ""}`,
            `Cámara: 435 representantes con voto, uno por distrito${house.length && house.length < 435 ? ` (${435 - house.length} ${435 - house.length === 1 ? "escaño vacante" : "escaños vacantes"})` : ""}`)}
            {delegates.length > 0 && tr(`, plus ${delegates.length} delegates without a floor vote`, `, más ${delegates.length} delegados sin voto en el pleno`)}.<br /><PartyCounts rows={house} /></p>
          <h3 className="small">{tr("Checks on the other branches", "Límites a los otros poderes")}</h3>
          <ul className="plain">
            <li>{tr("Can override a veto with a two-thirds vote in both chambers.", "Puede anular un veto con dos tercios de los votos en ambas cámaras.")}</li>
            <li>{tr("Can impeach (House) and remove (Senate) the President, judges and other officials.", "Puede acusar (Cámara) y destituir (Senado) al Presidente, a jueces y a otros funcionarios.")}</li>
            <li>{tr("Confirms (Senate) federal judges and senior officials.", "Confirma (Senado) a los jueces federales y altos funcionarios.")}</li>
          </ul>
          <p className="branch-links"><Link to="/members">{tr("Members", "Miembros")}</Link> <Link to="/bills">{tr("Bills", "Proyectos de ley")}</Link> <Link to="/week">{tr("This week", "Esta semana")}</Link> <Link to="/committees">{tr("Committees", "Comités")}</Link></p>
        </section>

        <section className="branch" aria-labelledby="b-exec">
          <WhiteHouse />
          <h2 id="b-exec">{tr("Executive branch", "Poder ejecutivo")}</h2>
          <p className="fine">{tr("The President · ", "El Presidente · ")}<Link to="/constitution#art2-s1">{tr("Article II of the Constitution", "Artículo II de la Constitución")}</Link></p>
          <p>{tr("Carries out and enforces federal laws, commands the armed forces, conducts foreign policy and runs federal departments and agencies. The Vice President presides over the Senate and breaks tie votes there.",
            "Ejecuta y hace cumplir las leyes federales, dirige las fuerzas armadas, conduce la política exterior y administra los departamentos y agencias federales. El Vicepresidente preside el Senado y desempata sus votaciones.")}</p>
          <h3 className="small">{tr("Who serves now", "Quiénes sirven ahora")}</h3>
          {president && <p>{tr("President", "Presidente")}: <strong>{president.name}</strong> <span className={partyClass(president.party)}>{president.party?.[0]}</span> <span className="fine">{tr(`term ${date(president.start_date)} – ${date(president.end_date)}`, `período ${date(president.start_date)} – ${date(president.end_date)}`)}</span></p>}
          {vp && <p>{tr("Vice President", "Vicepresidente")}: {vp.bioguide_id ? <Link to={`/member/${vp.bioguide_id}`}><strong>{vp.name}</strong></Link> : <strong>{vp.name}</strong>} <span className={partyClass(vp.party)}>{vp.party?.[0]}</span></p>}
          <p className="fine">{tr("The Cabinet is made up of the heads of the 15 executive departments. ", "El Gabinete está formado por los jefes de los 15 departamentos ejecutivos. ")}<a href="https://www.usa.gov/agency-index" rel="noopener">{tr("Departments and agencies (USA.gov)", "Departamentos y agencias (USA.gov)")}</a></p>
          <h3 className="small">{tr("Recent executive orders", "Órdenes ejecutivas recientes")}</h3>
          {orderCount != null && president && <p className="fine">{tr(`${orderCount.toLocaleString()} signed since ${date(president.start_date)}.`, `${orderCount.toLocaleString("es-US")} firmadas desde el ${date(president.start_date)}.`)}</p>}
          <ul className="plain items">
            {orders.map((o) => (
              <li key={o.document_number}>
                <a href={o.html_url} rel="noopener">{o.eo_number ? tr(`Executive Order ${o.eo_number}`, `Orden Ejecutiva ${o.eo_number}`) : o.title}</a>
                {o.eo_number && <>: {o.title}</>} <span className="fine">{tr("signed", "firmada el")} {date(o.signing_date)}</span>
              </li>
            ))}
          </ul>
          <h3 className="small">{tr("Checks on the other branches", "Límites a los otros poderes")}</h3>
          <ul className="plain">
            <li>{tr("Can veto bills passed by Congress.", "Puede vetar proyectos aprobados por el Congreso.")}</li>
            <li>{tr("Nominates federal judges, including Supreme Court justices.", "Nomina a los jueces federales, incluidos los magistrados de la Corte Suprema.")}</li>
          </ul>
          <p className="branch-links"><Link to="/nominations">{tr("Nominations", "Nominaciones")}</Link> <a href="https://www.federalregister.gov/presidential-documents/executive-orders" rel="noopener">{tr("All executive orders (Federal Register)", "Todas las órdenes ejecutivas (Registro Federal)")}</a></p>
        </section>

        <section className="branch" aria-labelledby="b-jud">
          <SupremeCourt />
          <h2 id="b-jud">{tr("Judicial branch", "Poder judicial")}</h2>
          <p className="fine">{tr("The federal courts · ", "Los tribunales federales · ")}<Link to="/constitution#art3-s1">{tr("Article III of the Constitution", "Artículo III de la Constitución")}</Link></p>
          <p>{tr("Decides cases about the Constitution and federal law. The Supreme Court is the highest court; below it are 13 courts of appeals and 94 district courts. Federal judges are nominated by the President, confirmed by the Senate, and serve for life.",
            "Decide casos sobre la Constitución y las leyes federales. La Corte Suprema es el tribunal más alto; debajo están 13 tribunales de apelaciones y 94 tribunales de distrito. Los jueces federales son nominados por el Presidente, confirmados por el Senado y sirven de por vida.")}</p>
          <h3 className="small">{tr("The Supreme Court", "La Corte Suprema")}</h3>
          <ul className="plain">
            {(court?.justices ?? []).map((j) => (
              <li key={j.name}>
                <strong>{j.name}</strong>{j.title === "chief" && <>, {tr("Chief Justice", "Presidente de la Corte")}</>}
                <span className="fine"> · {tr(`since ${date(j.seated)}, nominated by ${j.nominated_by}`, `desde el ${date(j.seated)}, nominado(a) por ${j.nominated_by}`)}</span>
              </li>
            ))}
          </ul>
          <h3 className="small">{tr("Checks on the other branches", "Límites a los otros poderes")}</h3>
          <ul className="plain">
            <li>{tr("Can rule that a law or an executive action violates the Constitution.", "Puede decidir que una ley o una acción del ejecutivo viola la Constitución.")}</li>
          </ul>
          <p className="branch-links">
            <a href="https://www.supremecourt.gov/opinions/opinions.aspx" rel="noopener">{tr("Supreme Court opinions", "Opiniones de la Corte Suprema")}</a>{" "}
            <a href={court?.source ?? "https://www.supremecourt.gov/about/biographies.aspx"} rel="noopener">{tr("Justices' biographies", "Biografías de los magistrados")}</a>
          </p>
          {court?.checked && <p className="fine">{tr(`Justices: supremecourt.gov, checked ${date(court.checked)}.`, `Magistrados: supremecourt.gov, verificado el ${date(court.checked)}.`)}</p>}
        </section>
      </div>

      <NotesList />
    </main>
  );
}
