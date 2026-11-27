import { Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation, useNavigationType } from "react-router-dom";
import ReportError from "./ReportError.jsx";
// Every page can cite a source with <Ref id text>; the page puts <NotesList /> at its end.
import { NotesProvider } from "./Notes.jsx";
import ThemeSwitch from "./ThemeSwitch.jsx";
import SearchSuggest from "./SearchSuggest.jsx";
import { useLang } from "../lib/i18n.jsx";
import { useAccount } from "../lib/auth.js";

// Site header on every page: name, main sections, and a search box for members and bills.
const TITLES = {
  "/": ["Who represents you?", "¿Quién le representa?"],
  "/search": ["Search", "Buscar"], "/members": ["Members of Congress", "Miembros del Congreso"],
  "/bills": ["Bills", "Proyectos de ley"], "/compare": ["Compare two members", "Comparar dos miembros"],
  "/week": ["This week in Congress", "Esta semana en el Congreso"], "/glossary": ["Glossary", "Glosario"],
  "/quiz": ["Quiz", "Cuestionario"], "/topics": ["Topics", "Temas"], "/topic": ["Topic", "Tema"],
  "/issues": ["Issues you care about", "Los temas que le importan"],
  "/elections": ["2028 candidates", "Candidatos de 2028"], "/on-the-ballot": ["On the ballot", "En la boleta"], "/corrections": ["Corrections", "Correcciones"],
  "/nominations": ["Nominations", "Nominaciones"], "/leadership": ["Congressional leadership", "Liderazgo del Congreso"], "/story": ["Look up a news story", "Buscar una noticia"],
  "/hearing": ["Hearing", "Audiencia"], "/map": ["Map", "Mapa"],
  "/government": ["Three branches of government", "Los tres poderes del gobierno"],
  "/budget": ["Federal budget", "Presupuesto federal"], "/measures": ["California ballot measures", "Medidas en la boleta de California"],
  "/officials": ["Elected officials", "Funcionarios electos"], "/local": ["Local officials", "Funcionarios locales"],
  "/state": ["State official", "Funcionario estatal"], "/committees": ["Committees", "Comités"],
  "/committee": ["Committee", "Comité"], "/member": ["Member of Congress", "Miembro del Congreso"],
  "/bill": ["Bill", "Proyecto de ley"], "/methods": ["How this site works", "Cómo funciona este sitio"],
  "/status": ["Site status", "Estado del sitio"], "/your-week": ["Your week", "Su semana"],
  "/first-time-voter": ["First time voting?", "¿Va a votar por primera vez?"],
  "/account": ["Your account", "Su cuenta"], "/unsubscribe": ["Unsubscribe", "Cancelar suscripción"],
};

// The menu: the three things most visitors come for, then everything else in a few groups that open
// and close. The group holding the current page starts open.
const MENU_GROUPS = [
  { id: "congress", title: ["Congress", "Congreso"], also: ["/member/", "/bill/", "/committee/", "/hearing/", "/topic/"], links: [
    ["/members", "Members", "Miembros"], ["/bills", "Bills", "Proyectos de ley"], ["/issues", "Your issues", "Sus temas"], ["/topics", "Topics", "Temas"],
    ["/committees", "Committees", "Comités"], ["/leadership", "Leadership", "Liderazgo"], ["/nominations", "Nominations", "Nominaciones"],
    ["/compare", "Compare two members", "Comparar dos miembros"], ["/map", "Map", "Mapa"]] },
  { id: "elections", title: ["Elections", "Elecciones"], links: [
    ["/first-time-voter", "First time voting?", "¿Va a votar por primera vez?"],
    ["/on-the-ballot", "On the ballot", "En la boleta"], ["/elections", "2028 candidates", "Candidatos 2028"],
    ["/measures", "2028 ballot measures (CA)", "Medidas en la boleta 2028 (CA)"]] },
  { id: "learn", title: ["Learn", "Aprender"], links: [
    ["/government", "Three branches", "Los tres poderes"], ["/budget", "Federal budget", "Presupuesto federal"],
    ["/glossary", "Glossary", "Glosario"], ["/quiz", "Quiz: do you vote like them?", "Cuestionario: ¿vota como ellos?"],
    ["/story", "Look up a news story", "Buscar una noticia"]] },
  { id: "about", title: ["About this site", "Sobre este sitio"], links: [
    ["/methods", "How this site works", "Cómo funciona este sitio"], ["/corrections", "Corrections", "Correcciones"],
    ["/status", "Site status", "Estado del sitio"]] },
];

// Site pages the search box can suggest by title: the menu's links and the three at its top.
const SITE_PAGES = [
  { to: "/", title: ["Find your officials", "Sus funcionarios"] }, { to: "/your-week", title: ["Your week", "Su semana"] },
  { to: "/week", title: ["This week in Congress", "Esta semana en el Congreso"] },
  ...MENU_GROUPS.flatMap((g) => g.links.map(([to, en, es]) => ({ to, title: [en, es] }))),
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");
  const { lang, setLang, t } = useLang();
  // Accounts are optional; the link says "Sign in" until someone is signed in on this browser.
  const account = useAccount();
  const accountLabel = account.status === "signedIn" ? t("Your account", "Su cuenta") : t("Sign in", "Iniciar sesión");
  // On phones the sections and search fold behind a Menu button; it closes on every page change.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);
  const menuRef = useRef(null);
  const menuButton = useRef(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !menuRef.current?.contains(e.target) && !e.target.closest?.(".menu-button")) {
        // Escape from inside the menu: focus goes back to the Menu button instead of being lost.
        if (e.type === "keydown" && menuRef.current?.contains(document.activeElement)) menuButton.current?.focus();
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [menuOpen]);
  // After following a link to another page, start at the top with focus on the page content, so a
  // screen reader announces the new page and Tab continues from it (not from the old link's spot).
  // Back and Forward keep the browser's own scroll position; links to a #section keep theirs.
  const navType = useNavigationType();
  const firstPage = useRef(true);
  useEffect(() => {
    if (firstPage.current) { firstPage.current = false; return; }
    if (navType !== "PUSH" || location.hash) return;
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);
  // A plain title for each section, so tabs, bookmarks and search results say where they lead.
  // Pages with a record (a member, a bill, a county) replace it with the record's name once loaded.
  useEffect(() => {
    const first = "/" + (location.pathname.split("/")[1] ?? "");
    const name = TITLES[first];
    document.title = name ? `${t(name[0], name[1])} · Civic Atlas` : "Civic Atlas";
  }, [location.pathname, lang]);

  function submit(e) {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <>
      <a className="skip-link" href="#main">{t("Skip to content", "Ir al contenido")}</a>
      <header className="site">
        <div className="site-inner">
          {/* One menu on every screen size (a three-line button, like Wikipedia's), so the header
              stays quiet; the search box stays in the header on wider screens. */}
          <button type="button" ref={menuButton} className="menu-button" aria-expanded={menuOpen} aria-controls="site-menu"
            aria-label={menuOpen ? t("Close menu", "Cerrar menú") : t("Menu", "Menú")} onClick={() => setMenuOpen(!menuOpen)}>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              {menuOpen ? <><line x1="5" y1="5" x2="15" y2="15" /><line x1="15" y1="5" x2="5" y2="15" /></>
                : <><line x1="3" y1="6" x2="17" y2="6" /><line x1="3" y1="10" x2="17" y2="10" /><line x1="3" y1="14" x2="17" y2="14" /></>}
            </svg>
          </button>
          <Link to="/" className="brand">Civic Atlas</Link>
          {location.pathname !== "/search" && (
            <form onSubmit={submit} role="search" className="site-search header-search">
              <SearchSuggest id="hs" value={q} onValueChange={setQ} pages={SITE_PAGES}
                ariaLabel={t("Search members and bills", "Buscar miembros y proyectos de ley")}
                placeholder={t("Name or bill (e.g. H.R. 1)", "Nombre o proyecto (p. ej., H.R. 1)")} />
            </form>
          )}
          <div id="site-menu" className={`site-menu${menuOpen ? " open" : ""}`} ref={menuRef}>
          <nav aria-label={t("Main", "Principal")}>
            <NavLink to="/" end>{t("Find your officials", "Sus funcionarios")}</NavLink>
            <NavLink to="/your-week">{t("Your week", "Su semana")}</NavLink>
            <NavLink to="/week">{t("This week in Congress", "Esta semana en el Congreso")}</NavLink>
            {MENU_GROUPS.map((g) => (
              <details key={g.id} className="menu-group" open={[...g.links.map(([to]) => to), ...(g.also ?? [])].some((to) => location.pathname.startsWith(to)) || undefined}>
                <summary>{t(...g.title)}</summary>
                {g.links.map(([to, en, es]) => <NavLink key={to} to={to}>{t(en, es)}</NavLink>)}
              </details>
            ))}
            {account.status !== "off" && <div className="menu-account"><NavLink to="/account">{accountLabel}</NavLink></div>}
          </nav>
          {location.pathname !== "/search" && (
            <form onSubmit={submit} role="search" className="site-search menu-search">
              <SearchSuggest id="ms" value={q} onValueChange={setQ} pages={SITE_PAGES}
                ariaLabel={t("Search members and bills", "Buscar miembros y proyectos de ley")}
                placeholder={t("Name or bill (e.g. H.R. 1)", "Nombre o proyecto (p. ej., H.R. 1)")} />
            </form>
          )}
          </div>
          {account.status !== "off" && <NavLink to="/account" className="account-link">{accountLabel}</NavLink>}
          <button type="button" className="link lang-switch" lang={lang === "es" ? "en" : "es"} onClick={() => setLang(lang === "es" ? "en" : "es")}>
            {lang === "es" ? "English" : "Español"}
          </button>
          <ThemeSwitch />
        </div>
      </header>
      <div id="main" tabIndex={-1}>
        <Suspense fallback={<main className="page"><p>{t("Loading…", "Cargando…")}</p></main>}>
          <NotesProvider key={location.pathname}>
            <Outlet />
          </NotesProvider>
        </Suspense>
      </div>
      <footer className="site-footer">
        <div className="site-inner">
          <Link to="/methods">{t("How this site works", "Cómo funciona este sitio")}</Link>
          <Link to="/corrections">{t("Corrections", "Correcciones")}</Link>
          <Link to="/status">{t("Site status", "Estado del sitio")}</Link>
          <ReportError />
        </div>
      </footer>
    </>
  );
}
