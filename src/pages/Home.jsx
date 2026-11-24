import { useState } from "react";
import { Link } from "react-router-dom";
import OfficialCard from "../components/OfficialCard.jsx";
import Turnstile from "../components/Turnstile.jsx";
import { TURNSTILE_SITE_KEY } from "../lib/config.js";
import { STATE_NAMES } from "../lib/format.js";
import { rememberRepresentatives } from "../lib/myReps.js";

export default function Home() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [lookups, setLookups] = useState(0);
  const needsCheck = Boolean(TURNSTILE_SITE_KEY);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!address.trim() || (needsCheck && !token)) return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`/api/lookup?address=${encodeURIComponent(address.trim())}`, {
        headers: needsCheck ? { "CF-Turnstile-Token": token } : {},
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Lookup failed.");
      setResult(body);
      rememberRepresentatives(body.officials.filter((o) => o.seat_status !== "pending_update").map((o) => o.bioguide_id));
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    } finally {
      setLookups((n) => n + 1); // triggers a fresh bot-check token
    }
  }

  return (
    <main className="page">
      <header>
        <h1>Civic Atlas</h1>
        <p className="lede">
          Enter an address to see who represents you in Congress, with their votes, bills,
          committees, and campaign finance, drawn from official sources.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="lookup">
        <label htmlFor="address">Address</label>
        <div className="row">
          <input
            id="address"
            type="text"
            autoComplete="street-address"
            placeholder="123 Main St, City, State"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <button type="submit" disabled={status === "loading" || (needsCheck && !token)}>
            {status === "loading" ? "Looking up…" : "Look up"}
          </button>
        </div>
        {needsCheck && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setToken} resetSignal={lookups} />}
        <p className="fine">Your address is used only to find your district. It isn't stored.</p>
      </form>

      {status === "error" && <p className="notice">{error}</p>}

      {status === "done" && result && (
        <section className="results">
          <h2>
            Representing {STATE_NAMES[result.state] ?? result.state}
            {result.districts.length === 1 && result.officials.some((o) => o.chamber === "house" && o.district !== 0)
              ? `, District ${result.districts[0]}` : ""}
          </h2>
          {result.approximate && (
            <p className="notice">
              This location may fall in more than one district. A full street address gives an exact match.
            </p>
          )}
          <ul className="cards">
            {result.officials.map((o) => <OfficialCard key={`${o.chamber}-${o.bioguide_id}`} official={o} />)}
          </ul>
          <p className="fine">District: {result.sources.district}. Officials: {result.sources.officials}.</p>
        </section>
      )}

      <footer>
        Data sources: Congress.gov, GovInfo, House Clerk, Senate.gov, FEC. <Link to="/methods">How this site works</Link>
      </footer>
    </main>
  );
}
