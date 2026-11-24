import { Suspense, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import ReportError from "./ReportError.jsx";
import { useLang } from "../lib/i18n.jsx";

// Pages fully available in Spanish. Others show a short note in Spanish that they're in English.
const SPANISH = [/^\/$/, /^\/member\/[A-Z]\d{6}$/, /^\/bill\//, /^\/glossary$/, /^\/week$/, /^\/hearing\//];

// Site header on every page: name, main sections, and a search box for members and bills.
export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const { lang, setLang, t } = useLang();

  function submit(e) {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <>
      <a className="skip-link" href="#main">{t("Skip to content", "Ir al contenido")}</a>
      <header className="site">
        <div className="site-inner">
          <Link to="/" className="brand">Civic Atlas</Link>
          <nav>
            <NavLink to="/week">{t("This week", "Esta semana")}</NavLink>
            <NavLink to="/members">{t("Members", "Miembros")}</NavLink>
            <NavLink to="/topics">{t("Topics", "Temas")}</NavLink>
            <NavLink to="/bills">{t("Bills", "Proyectos de ley")}</NavLink>
            <NavLink to="/committees">{t("Committees", "Comités")}</NavLink>
          </nav>
          {location.pathname !== "/search" && (
            <form onSubmit={submit} role="search" className="site-search">
              <input type="search" aria-label={t("Search members and bills", "Buscar miembros y proyectos de ley")}
                placeholder={t("Name or bill (e.g. H.R. 1)", "Nombre o proyecto (p. ej., H.R. 1)")}
                value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          )}
          <button type="button" className="link lang-switch" lang={lang === "es" ? "en" : "es"} onClick={() => setLang(lang === "es" ? "en" : "es")}>
            {lang === "es" ? "English" : "Español"}
          </button>
        </div>
      </header>
      <div id="main" tabIndex={-1}>
        {lang === "es" && !SPANISH.some((r) => r.test(location.pathname)) && (
          <p className="notice lang-note page">Esta página todavía está solo en inglés. Los registros oficiales se muestran tal como se publicaron.</p>
        )}
        <Suspense fallback={<main className="page"><p>{t("Loading…", "Cargando…")}</p></main>}>
          <Outlet />
        </Suspense>
      </div>
      <footer className="site-footer">
        <div className="site-inner">
          <Link to="/methods">{t("How this site works", "Cómo funciona este sitio")}</Link>
          <Link to="/glossary">{t("Glossary", "Glosario")}</Link>
          <Link to="/corrections">{t("Corrections", "Correcciones")}</Link>
          <Link to="/compare">{t("Compare two members", "Comparar dos miembros")}</Link>
          <Link to="/quiz">{t("Quiz", "Cuestionario")}</Link>
          <Link to="/elections">{t("2028 candidates", "Candidatos 2028")}</Link>
          <Link to="/nominations">{t("Nominations", "Nominaciones")}</Link>
          <Link to="/story">{t("Look up a news story", "Buscar una noticia")}</Link>
          <ReportError />
        </div>
      </footer>
    </>
  );
}
