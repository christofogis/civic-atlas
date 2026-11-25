import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import LookupResults from "../components/LookupResults.jsx";
import { saveDistricts } from "../lib/savedDistricts.js";
import Turnstile from "../components/Turnstile.jsx";
import { TURNSTILE_SITE_KEY, GOOGLE_PLACES_KEY } from "../lib/config.js";
import { stateName } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";
import { rememberRepresentatives, myRepresentatives, representativesOutdated } from "../lib/myReps.js";
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
  "That location couldn't be used.": "No se pudo usar esa ubicación.",
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

  // The bot check usually finishes in the background before anyone presses the button. If it
  // hasn't yet, the lookup waits for it and then goes ahead on its own.
  const [waiting, setWaiting] = useState(false);
  const resultsRef = useRef(null);
  useEffect(() => { if (waiting && token) { setWaiting(false); runLookup(point); } }, [waiting, token]);
  useEffect(() => {
    if (status === "done") resultsRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [status]);

  // A lookup is by address, or by the browser's location when the visitor asks for it.
  const [point, setPoint] = useState(null);
  function start(nextPoint = null) {
    setPoint(nextPoint);
    if (needsCheck && !token) { setWaiting(true); setStatus("loading"); return; }
    runLookup(nextPoint);
  }
  function handleSubmit(e) {
    e.preventDefault();
    if (!address.trim()) return;
    start(null);
  }
  function lookUpMyLocation() {
    if (!navigator.geolocation) return;
    setStatus("loading"); setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => start({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { setError(t("Your location isn't available. Check that location access is allowed for this site, or type an address.", "Su ubicación no está disponible. Revise que este sitio tenga permiso para usar la ubicación, o escriba una dirección.")); setStatus("error"); },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  async function runLookup(where = point) {
    setStatus("loading");
    setError("");
    try {
      const q = where ? `lat=${where.lat.toFixed(5)}&lng=${where.lng.toFixed(5)}` : `address=${encodeURIComponent(address.trim())}`;
      const res = await fetch(`/api/lookup?${q}`, {
        headers: needsCheck ? { "CF-Turnstile-Token": token } : {},
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Lookup failed.");
      setResult(body);
      saveDistricts(body);
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
          <h1>{t("Who represents you?", "¿Quién le representa?")}</h1>
          <div className="toggle home-lang" role="group" aria-label="Language / Idioma">
            <button type="button" lang="en" aria-pressed={lang === "en"} className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>English</button>
            <button type="button" lang="es" aria-pressed={lang === "es"} className={lang === "es" ? "on" : ""} onClick={() => setLang("es")}>Español</button>
          </div>
        </div>
        <p className="home-promise">
          {t("Enter your address to see every official elected to represent it, what each one does, and their record, from official sources.",
            "Escriba su dirección para ver a cada funcionario elegido para representarla, qué hace cada uno y su historial, según fuentes oficiales.")}
        </p>
        <ul className="home-levels">
          <li>{t("U.S. Congress", "Congreso de EE. UU.")}</li>
          <li>{t("State legislature and statewide offices", "Legislatura y cargos estatales")}</li>
          <li>{t("County and city (Orange County, CA)", "Condado y ciudad (Condado de Orange, CA)")}</li>
        </ul>
      </header>

      {representativesOutdated() && status === "idle" && (
        <p className="notice">{t("A new Congress has begun, and some House districts changed. Look up your address again to see your current officials.", "Comenzó un nuevo Congreso y algunos distritos de la Cámara cambiaron. Busque su dirección de nuevo para ver a sus funcionarios actuales.")}</p>
      )}
      <form onSubmit={handleSubmit} className="lookup">
        <label htmlFor="address">{mine.size > 0 ? t("Look up another address", "Buscar otra dirección") : t("Your address", "Su dirección")}</label>
        <div className="row">
          <AddressInput id="address" placeholder={t("123 Main St, City, State", "123 Main St, ciudad, estado")} value={address} onChange={setAddress} />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? t("Looking up…", "Buscando…") : t("Find my officials", "Buscar mis funcionarios")}
          </button>
        </div>
        {typeof navigator !== "undefined" && "geolocation" in navigator && (
          <p className="use-location">
            <button type="button" className="link" onClick={lookUpMyLocation} disabled={status === "loading"}>{t("Use my current location instead", "Usar mi ubicación actual")}</button>
          </p>
        )}
        {needsCheck && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setToken} resetSignal={lookups} />}
        <p className="fine">
          {t("Your address or location is used only to find your districts. We don't store it.", "Su dirección o ubicación se usa solo para encontrar sus distritos. No la guardamos.")}
          {GOOGLE_PLACES_KEY && t(" Suggestions as you type come from Google, which receives what you type in this box.", " Las sugerencias mientras escribe vienen de Google, que recibe lo que escribe en esta casilla.")}
        </p>
      </form>

      {status === "error" && <p className="notice">{error}</p>}

      {status === "done" && result && <LookupResults result={result} sectionRef={resultsRef} />}

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
