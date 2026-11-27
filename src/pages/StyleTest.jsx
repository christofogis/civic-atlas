import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tr } from "../lib/lang.js";
import Portrait from "../components/Portrait.jsx";

// A preview of a darker "slate" look, for Chris to judge before anything changes site-wide.
// The look applies only while this page is open (a class on <html>). Not linked from the menu.
const P = (id) => `https://unitedstates.github.io/images/congress/225x275/${id}.jpg`;

export default function StyleTest() {
  const [mode, setMode] = useState("dark");
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("slate", "slate-light");
    html.classList.add(mode === "dark" ? "slate" : "slate-light");
    return () => html.classList.remove("slate", "slate-light");
  }, [mode]);
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots"; robots.content = "noindex";
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  return (
    <main className="page wide slate-test">
      <p className="fine">{tr("Style test: the new look in dark and light. The dark colors are now the site's dark mode; the light version is shown only here until it's approved.", "Prueba de estilo: el nuevo aspecto en oscuro y claro. Los colores oscuros ya son el modo oscuro del sitio; la versión clara se muestra solo aquí hasta que se apruebe.")}</p>
      <div className="tabs" role="group" aria-label={tr("Version", "Versión")}>
        <button type="button" className={mode === "dark" ? "on" : ""} aria-pressed={mode === "dark"} onClick={() => setMode("dark")}>{tr("Dark", "Oscuro")}</button>
        <button type="button" className={mode === "light" ? "on" : ""} aria-pressed={mode === "light"} onClick={() => setMode("light")}>{tr("Light", "Claro")}</button>
      </div>

      <section className="sl-card">
        <span className="sl-pill sl-mono"><span className="sl-dot" />{tr("Your member of Congress", "Su miembro del Congreso")}</span>
        <div className="sl-person">
          <Portrait party="Democrat" src={P("T000491")} alt="Derek Tran" />
          <div>
            <h2 className="sl-title"><Link to="/member/T000491">Derek Tran</Link></h2>
            <p className="sl-lede">U.S. Representative, California District 45. {tr("Current term began Jan 3, 2025.", "Período actual desde el 3 de enero de 2025.")}</p>
          </div>
        </div>
        <div className="sl-chips"><span>{tr("Votes", "Votos")}</span><span>{tr("Bills", "Proyectos")}</span><span>{tr("Committees", "Comités")}</span><span>{tr("Money", "Dinero")}</span></div>
        <div className="sl-stat">
          <strong>96%</strong>
          <div>{tr("of roll calls voted on in the 119th Congress (typical member: 97%)", "de las votaciones en el 119.º Congreso (miembro típico: 97 %)")}<span className="sl-src">{tr("Source: House Clerk roll-call records", "Fuente: registros de votación de la Secretaría de la Cámara")}</span></div>
        </div>
        <div className="sl-stat">
          <strong>50.1%</strong>
          <div>{tr("of the vote in the 2024 general election", "del voto en la elección general de 2024")}<span className="sl-src">{tr("Source: House Clerk, Statistics of the Congressional Election", "Fuente: Secretaría de la Cámara, estadísticas electorales")}</span></div>
        </div>
        <div className="sl-foot"><span>{tr("Updated daily", "Se actualiza a diario")}</span><Link to="/member/T000491">{tr("See the full record", "Ver el historial completo")} →</Link></div>
      </section>

      <section className="sl-card">
        <span className="sl-label">{tr("Bill that became law", "Proyecto que se convirtió en ley")}</span>
        <h2 className="sl-title"><Link to="/bill/119/hr/1">H.R. 1: One Big Beautiful Bill Act</Link></h2>
        <p className="sl-lede">{tr("Became law on Jul 4, 2025 (Public Law 119-21).", "Se convirtió en ley el 4 de julio de 2025 (Ley Pública 119-21).")}</p>
        <ol className="sl-track">
          <li>{tr("Introduced", "Presentado")} <span>May 20, 2025</span></li>
          <li>{tr("Passed House", "Aprobado en la Cámara")} <span>May 22, 2025</span></li>
          <li>{tr("Passed Senate", "Aprobado en el Senado")} <span>Jul 1, 2025</span></li>
          <li>{tr("Became law", "Ley")} <span>Jul 4, 2025</span></li>
        </ol>
        <div className="sl-stats-row">
          <div><strong>47</strong><span>{tr("Roll-call votes", "Votaciones nominales")}</span></div>
          <div><strong>3,422</strong><span>{tr("Organizations lobbying", "Organizaciones que cabildearon")}</span></div>
        </div>
        <div className="sl-foot"><span>{tr("Plain labels instead of all-caps tags", "Etiquetas simples en lugar de mayúsculas")}</span><Link to="/bill/119/hr/1">{tr("Read the bill page", "Ver el proyecto")} →</Link></div>
      </section>

      <section className="sl-card">
        <span className="sl-pill sl-mono sl-pill-amber"><span className="sl-dot" />{tr("Recent vote", "Votación reciente")}</span>
        <p className="sl-lede">{tr("A Yes vote was to pass H.R. 4464 under expedited rules (suspension of the rules), which needs two-thirds. It passed, 401–0, so it goes to the Senate.", "Un voto Sí era para aprobar H.R. 4464 con reglas abreviadas, lo que requiere dos tercios. Se aprobó 401–0, así que pasa al Senado.")}</p>
        <p className="fine">Nov 19, 2026 · <a href="https://clerk.house.gov">On Motion to Suspend the Rules and Pass</a></p>
      </section>

      <section className="sl-card">
        <span className="sl-label">{tr("On the ballot in 2028", "En la boleta en 2028")}</span>
        <ul className="face-grid">
          {[["P000145", "Alex Padilla", "Democrat", "California"], ["B001319", "Katie Boyd Britt", "Republican", "Alabama"], ["K000377", "Mark Kelly", "Democrat", "Arizona"]].map(([id, n, p, s]) => (
            <li key={id}><Link to={`/member/${id}`}><Portrait size="tile" party={p} src={P(id)} /><span className="face-name">{n}</span></Link><span className="face-meta">{s}</span></li>
          ))}
        </ul>
      </section>
    </main>
  );
}
