import { useState } from "react";
import { Link } from "react-router-dom";
import OfficialCard from "../components/OfficialCard.jsx";
import Turnstile from "../components/Turnstile.jsx";
import { TURNSTILE_SITE_KEY, GOOGLE_PLACES_KEY } from "../lib/config.js";
import { stateName } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";
import { rememberRepresentatives, myRepresentatives } from "../lib/myReps.js";
import MyReps from "../components/MyReps.jsx";
import AddressInput from "../components/AddressInput.jsx";

export default function Home() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [lookups, setLookups] = useState(0);
  const needsCheck = Boolean(TURNSTILE_SITE_KEY);
  const [mine, setMine] = useState(() => myRepresentatives());
  const { t } = useLang();

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
      const ids = body.officials.filter((o) => o.seat_status !== "pending_update").map((o) => o.bioguide_id);
      rememberRepresentatives(ids);
      setMine(new Set(ids));
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
          {t("Enter an address to see who represents you in Congress, with their votes, bills, committees, and campaign finance, drawn from official sources.",
            "Escriba una dirección para ver quién le representa en el Congreso, con sus votos, proyectos de ley, comités y finanzas de campaña, según fuentes oficiales.")}
        </p>
      </header>

      {mine.size > 0 && status !== "done" && <MyReps ids={mine} onForget={() => setMine(new Set())} />}

      <form onSubmit={handleSubmit} className="lookup">
        <label htmlFor="address">{mine.size > 0 ? t("Look up another address", "Buscar otra dirección") : t("Address", "Dirección")}</label>
        <div className="row">
          <AddressInput id="address" placeholder={t("123 Main St, City, State", "123 Main St, ciudad, estado")} value={address} onChange={setAddress} />
          <button type="submit" disabled={status === "loading" || (needsCheck && !token)}>
            {status === "loading" ? t("Looking up…", "Buscando…") : t("Look up", "Buscar")}
          </button>
        </div>
        {needsCheck && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setToken} resetSignal={lookups} />}
        <p className="fine">
          {t("Your address is used only to find your district. We don't store it.", "Su dirección se usa solo para encontrar su distrito. No la guardamos.")}
          {GOOGLE_PLACES_KEY && t(" Suggestions as you type come from Google, which receives what you type in this box.", " Las sugerencias mientras escribe vienen de Google, que recibe lo que escribe en esta casilla.")}
        </p>
      </form>

      {status === "error" && <p className="notice">{error}</p>}

      {status === "done" && result && (
        <section className="results">
          <h2>
            {t("Representing", "Representantes de")} {stateName(result.state)}
            {result.districts.length === 1 && result.officials.some((o) => o.chamber === "house" && o.district !== 0)
              ? t(`, District ${result.districts[0]}`, `, distrito ${result.districts[0]}`) : ""}
          </h2>
          {result.approximate && (
            <p className="notice">
              {t("This location may fall in more than one district. A full street address gives an exact match.", "Este lugar puede estar en más de un distrito. Una dirección completa da un resultado exacto.")}
            </p>
          )}
          <ul className="cards">
            {result.officials.map((o) => <OfficialCard key={`${o.chamber}-${o.bioguide_id}`} official={o} />)}
          </ul>
          <p className="fine">{t("District", "Distrito")}: {result.sources.district}. {t("Officials", "Funcionarios")}: {result.sources.officials}.</p>
        </section>
      )}

      <section className="home-links">
        <Link to="/quiz" className="home-card"><strong>{t("Do you vote like your representatives?", "¿Vota usted como sus representantes?")}</strong><span>{t("Answer 10 real bills Congress voted on and see who agrees with you.", "Responda sobre 10 proyectos reales que el Congreso votó y vea quién coincide con usted. (En inglés)")}</span></Link>
        <Link to="/week" className="home-card"><strong>{t("This week in Congress", "Esta semana en el Congreso")}</strong><span>{t("What's scheduled, and what passed, failed or became law.", "Lo programado y lo que se aprobó, fracasó o se convirtió en ley.")}</span></Link>
      </section>

    </main>
  );
}
