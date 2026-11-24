import { Suspense, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import ReportError from "./ReportError.jsx";

// Site header on every page: name, main sections, and a search box for members and bills.
export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState("");

  function submit(e) {
    e.preventDefault();
    if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <>
      <header className="site">
        <div className="site-inner">
          <Link to="/" className="brand">Civic Atlas</Link>
          <nav>
            <NavLink to="/week">This week</NavLink>
            <NavLink to="/members">Members</NavLink>
            <NavLink to="/topics">Topics</NavLink>
            <NavLink to="/bills">Bills</NavLink>
            <NavLink to="/committees">Committees</NavLink>
          </nav>
          {location.pathname !== "/search" && (
            <form onSubmit={submit} role="search" className="site-search">
              <input type="search" aria-label="Search members and bills" placeholder="Name or bill (e.g. H.R. 1)"
                value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          )}
        </div>
      </header>
      <Suspense fallback={<main className="page"><p>Loading…</p></main>}>
        <Outlet />
      </Suspense>
      <footer className="site-footer">
        <div className="site-inner">
          <Link to="/methods">How this site works</Link>
          <Link to="/glossary">Glossary</Link>
          <Link to="/compare">Compare two members</Link>
          <Link to="/quiz">Quiz</Link>
          <Link to="/elections">2028 candidates</Link>
          <ReportError />
        </div>
      </footer>
    </>
  );
}
