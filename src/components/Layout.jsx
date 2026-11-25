import { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import ReportError from "./ReportError.jsx";
import { useLang } from "../lib/i18n.jsx";

// Site header on every page: name, main sections, and a search box for members and bills.
export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const { lang, setLang, t } = useLang();
  // On phones the sections and search fold behind a Menu button; it closes on every page change.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);

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
          <button type="button" className="menu-button" aria-expanded={menuOpen} aria-controls="site-menu" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? t("Close", "Cerrar") : t("Menu", "Menú")}
          </button>
          <div id="site-menu" className={`site-menu${menuOpen ? " open" : ""}`}>
          <nav aria-label={t("Main", "Principal")}>
            <NavLink to="/" end>{t("Find your officials", "Sus funcionarios")}</NavLink>
            <NavLink to="/week">{t("This week", "Esta semana")}</NavLink>
            <NavLink to="/map">{t("Map", "Mapa")}</NavLink>
            <NavLink to="/members">{t("Members", "Miembros")}</NavLink>
            <NavLink to="/topics">{t("Topics", "Temas")}</NavLink>
            <NavLink to="/bills">{t("Bills", "Proyectos de ley")}</NavLink>
            <NavLink to="/committees">{t("Committees", "Comités")}</NavLink>
            <NavLink to="/government">{t("Three branches", "Los tres poderes")}</NavLink>
          </nav>
          {location.pathname !== "/search" && (
            <form onSubmit={submit} role="search" className="site-search">
              <input type="search" aria-label={t("Search members and bills", "Buscar miembros y proyectos de ley")}
                placeholder={t("Name or bill (e.g. H.R. 1)", "Nombre o proyecto (p. ej., H.R. 1)")}
                value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          )}
          </div>
          <button type="button" className="link lang-switch" lang={lang === "es" ? "en" : "es"} onClick={() => setLang(lang === "es" ? "en" : "es")}>
            {lang === "es" ? "English" : "Español"}
          </button>
        </div>
      </header>
      <div id="main" tabIndex={-1}>
        <Suspense fallback={<main className="page"><p>{t("Loading…", "Cargando…")}</p></main>}>
          <Outlet />
        </Suspense>
      </div>
      <footer className="site-footer">
        <div className="site-inner">
          <Link to="/methods">{t("How this site works", "Cómo funciona este sitio")}</Link>
          <Link to="/government">{t("Three branches", "Los tres poderes")}</Link>
          <Link to="/budget">{t("Federal budget", "Presupuesto federal")}</Link>
          <Link to="/glossary">{t("Glossary", "Glosario")}</Link>
          <Link to="/corrections">{t("Corrections", "Correcciones")}</Link>
          <Link to="/compare">{t("Compare two members", "Comparar dos miembros")}</Link>
          <Link to="/quiz">{t("Quiz", "Cuestionario")}</Link>
          <Link to="/elections">{t("2028 candidates", "Candidatos 2028")}</Link>
          <Link to="/measures">{t("2028 ballot measures (CA)", "Medidas en la boleta 2028 (CA)")}</Link>
          <Link to="/nominations">{t("Nominations", "Nominaciones")}</Link>
          <Link to="/story">{t("Look up a news story", "Buscar una noticia")}</Link>
          <ReportError />
        </div>
      </footer>
    </>
  );
}
