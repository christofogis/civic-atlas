import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";

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
            <NavLink to="/members">Members</NavLink>
            <NavLink to="/bills">Bills</NavLink>
            <NavLink to="/compare">Compare</NavLink>
            <NavLink to="/methods">Methods</NavLink>
          </nav>
          {location.pathname !== "/search" && (
            <form onSubmit={submit} role="search" className="site-search">
              <input type="search" aria-label="Search members and bills" placeholder="Name or bill (e.g. H.R. 1)"
                value={q} onChange={(e) => setQ(e.target.value)} />
            </form>
          )}
        </div>
      </header>
      <Outlet />
    </>
  );
}
