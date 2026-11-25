import { useState } from "react";
import { Link } from "react-router-dom";
import LocalOfficials from "../components/LocalOfficials.jsx";
import StateOfficialCard from "../components/StateOfficialCard.jsx";
import OfficialCard from "../components/OfficialCard.jsx";
import Turnstile from "../components/Turnstile.jsx";
import { TURNSTILE_SITE_KEY, GOOGLE_PLACES_KEY } from "../lib/config.js";
import { stateName } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";
import { rememberRepresentatives, myRepresentatives } from "../lib/myReps.js";
import MyReps from "../components/MyReps.jsx";
import AddressInput from "../components/AddressInput.jsx";

// Lookup errors come from /api/lookup in English; these are their Spanish versions.
const ERR_ES = {
  "Enter a street address, city and state, or a ZIP code.": "Escriba una dirección con ciudad y estado, o un código postal.",
  "Address lookup is not configured.": "La búsqueda de direcciones no está configurada.",
  "Please complete the verification and try again.": "Complete la verificación e inténtelo de nuevo.",
  "That address couldn't be found.": "No se encontró esa dirección.",
  "The address service is unavailable. Try again shortly.": "El servicio de direcciones no está disponible. Inténtelo en un momento.",
  "Couldn't load officials right now. Try again shortly.": "No se pudieron cargar los funcionarios. Inténtelo en un momento.",
  "Lookup failed.": "La búsqueda falló.",
};

export default function Home() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  const [lookups, setLookups] = useState(0);
  const needsCheck = Boolean(TURNSTILE_SITE_KEY);
  const [mine, setMine] = useState(() => myRepresentatives());
  const { t, lang, setLang } = useLang();

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
      setError(t(err.message, ERR_ES[err.message] ?? "La búsqueda falló. Inténtelo de nuevo."));
      setStatus("error");
    } finally {
      setLookups((n) => n + 1); // triggers a fresh bot-check token
    }
  }

  return (
    <main className="page full home">
      <div className="home-grid">
      <div className="home-main">
      <header>
        <div className="home-title">
          <h1>Civic Atlas</h1>
          <div className="toggle home-lang" role="group" aria-label="Language / Idioma">
            <button type="button" lang="en" aria-pressed={lang === "en"} className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>English</button>
            <button type="button" lang="es" aria-pressed={lang === "es"} className={lang === "es" ? "on" : ""} onClick={() => setLang("es")}>Español</button>
          </div>
        </div>
        <p className="lede">
          {t("Enter an address to see who represents you in Congress, with their votes, bills, committees, and campaign finance, drawn from official sources.",
            "Escriba una dirección para ver quién le representa en el Congreso, con sus votos, proyectos de ley, comités y finanzas de campaña, según fuentes oficiales.")}
        </p>
      </header>

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
          {result.state_officials?.length > 0 && (
            <>
              <h2>{t(`State of ${stateName(result.state)}`, `Estado de ${stateName(result.state)}`)}</h2>
              <ul className="cards">
                {result.state_officials.map((o) => <StateOfficialCard key={`${o.type}-${o.id}`} official={o} state={result.state} />)}
              </ul>
              <p className="fine">{t("State legislators shown are for the districts that include this address. Statewide offices shown are the governor, lieutenant governor, attorney general and secretary of state as listed by Open States; a few states' offices aren't listed there yet, and other statewide offices (such as treasurer) aren't shown for any state.",
                "Los legisladores estatales que se muestran son los de los distritos que incluyen esta dirección. Los cargos estatales que se muestran son gobernador, vicegobernador, fiscal general y secretario de estado según Open States; algunos estados aún no aparecen allí, y otros cargos estatales (como tesorero) no se muestran para ningún estado.")}</p>
            </>
          )}
          <LocalOfficials local={result.local} approximate={result.approximate} />
          <p className="fine">{t("District", "Distrito")}: {result.sources.district}. {t("Officials", "Funcionarios")}: {result.sources.officials}{result.sources.state_officials ? `; ${result.sources.state_officials}` : ""}.</p>
        </section>
      )}

      </div>
      <div className="home-side">
      {mine.size > 0 && status !== "done" && <MyReps ids={mine} onForget={() => setMine(new Set())} />}
      <section className="home-links">
        <Link to="/quiz" className="home-card"><strong>{t("Do you vote like your representatives?", "¿Vota usted como sus representantes?")}</strong><span>{t("Answer 10 real bills Congress voted on and see who agrees with you.", "Responda sobre 10 proyectos reales que el Congreso votó y vea quién coincide con usted.")}</span></Link>
        <Link to="/map" className="home-card"><strong>{t("Explore the map", "Explore el mapa")}</strong><span>{t("States and congressional districts, down to your street. Tap one to see who represents it.", "Estados y distritos del Congreso, hasta su calle. Toque uno para ver quién lo representa.")}</span></Link>
        <Link to="/government" className="home-card"><strong>{t("Three branches of government", "Los tres poderes del gobierno")}</strong><span>{t("Congress, the President and the courts: what each does and who serves now.", "El Congreso, el Presidente y los tribunales: qué hace cada uno y quiénes sirven ahora.")}</span></Link>
        <Link to="/week" className="home-card"><strong>{t("This week in Congress", "Esta semana en el Congreso")}</strong><span>{t("What's scheduled, and what passed, failed or became law.", "Lo programado y lo que se aprobó, fracasó o se convirtió en ley.")}</span></Link>
      </section>
      </div>
      </div>
    </main>
  );
}
