import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import LookupResults from "../components/LookupResults.jsx";
import { saveDistricts, savedDistricts, forgetDistricts } from "../lib/savedDistricts.js";
import Turnstile from "../components/Turnstile.jsx";
import { TURNSTILE_SITE_KEY, GOOGLE_PLACES_KEY } from "../lib/config.js";
import { stateName } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";
import { rememberRepresentatives, myRepresentatives, representativesOutdated, forgetRepresentatives } from "../lib/myReps.js";
import HomePersonal from "../components/HomePersonal.jsx";
import AddressInput from "../components/AddressInput.jsx";
import HomeDashboard from "../components/HomeDashboard.jsx";
import IssuesCard from "../components/IssuesCard.jsx";
import { BallotDrawing, MapDrawing, BranchesDrawing, WeekDrawing } from "../components/FeatureDrawings.jsx";

// Lookup errors come from /api/lookup in English; these are their Spanish versions.
const ERR_ES = {
  "Enter a street address, city and state, or a ZIP code.": "Escriba una dirección con ciudad y estado, o un código postal.",
  "Address lookup is not configured.": "La búsqueda de direcciones no está configurada.",
  "Please complete the verification and try again.": "Complete la verificación e inténtelo de nuevo.",
  "That address couldn't be found.": "No se encontró esa dirección.",
  "The address service is unavailable. Try again shortly.": "El servicio de direcciones no está disponible. Inténtelo de nuevo en un momento.",
  "Couldn't load officials right now. Try again shortly.": "No se pudieron cargar los funcionarios. Inténtelo de nuevo en un momento.",
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
  // The bot check's script is heavy, so it loads only once someone starts using the form
  // (focus, tap or typing), not with the page. A lookup waits for its token either way.
  const [armed, setArmed] = useState(false);
  const arm = () => { if (!armed) setArmed(true); };
  const [mine, setMine] = useState(() => myRepresentatives());
  const { t } = useLang();

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
    arm();
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

  // A remembered lookup puts the visitor's own officials first; the address box moves behind a link.
  const saved = savedDistricts();
  const returning = mine.size > 0 && Boolean(saved) && status !== "done";
  const forget = () => {
    forgetRepresentatives(); forgetDistricts(); setMine(new Set()); setResult(null); setStatus("idle"); setAddress("");
    requestAnimationFrame(() => { window.scrollTo({ top: 0 }); document.getElementById("address")?.focus(); });
  };
  const lookupForm = (
    <>
      {representativesOutdated() && status === "idle" && (
        <p className="notice">{t("A new Congress has begun, and some House districts changed. Look up your address again to see your current officials.", "Comenzó un nuevo Congreso y algunos distritos de la Cámara cambiaron. Busque su dirección de nuevo para ver a sus funcionarios actuales.")}</p>
      )}
      <form onSubmit={handleSubmit} className="lookup" onFocusCapture={arm} onPointerDownCapture={arm} onKeyDownCapture={arm}>
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
        {needsCheck && armed && <Turnstile siteKey={TURNSTILE_SITE_KEY} onToken={setToken} resetSignal={lookups} />}
        <p className="fine">
          {t("Your address or location is used only to find your districts. We don't store it.", "Su dirección o ubicación se usa solo para encontrar sus distritos. No la guardamos.")}
          {GOOGLE_PLACES_KEY && t(" Suggestions as you type come from Google, which receives what you type in this box.", " Las sugerencias mientras escribe vienen de Google, que recibe lo que escribe en esta casilla.")}
        </p>
      </form>
      {status === "error" && <p className="notice">{error}</p>}
    </>
  );

  const features = [
    ["/quiz", BallotDrawing, t("Do you vote like your representatives?", "¿Vota usted como sus representantes?"), t("Answer 10 real bills", "Responda sobre 10 proyectos reales")],
    ["/map", MapDrawing, t("Explore the map", "Explore el mapa"), t("Districts down to your street", "Distritos hasta su calle")],
    ["/government", BranchesDrawing, t("Three branches", "Los tres poderes"), t("Who does what, and who serves now", "Quién hace qué y quién sirve ahora")],
    ["/week", WeekDrawing, t("This week in Congress", "Esta semana en el Congreso"), t("What's scheduled and what passed", "Lo programado y lo aprobado")],
  ];

  return (
    <main className="page full home">
      {/* Dashboard: the lookup and four ways in at the top; below, short tiles of what's coming
          up, then the visitor's own officials if a lookup is remembered on this device. */}
      <section className="home-top">
      <div className="home-hero">
        {returning && <HomePersonal saved={saved} onForget={forget} />}
        {returning ? (
          <details className="other-address" open={status !== "idle" || undefined}>
            <summary>{t("Look up another address", "Buscar otra dirección")}</summary>
            {lookupForm}
          </details>
        ) : <>
        <h1>{t("Who represents you?", "¿Quién le representa?")}</h1>
        <p className="home-promise">
          {t("Enter your address to see everyone elected to represent it, in Congress, your state and (in Orange County, CA) your county and city, with their records from official sources.",
            "Escriba su dirección para ver a todos los elegidos para representarla, en el Congreso, su estado y (en el Condado de Orange, CA) su condado y ciudad, con su historial según fuentes oficiales.")}
        </p>

        {lookupForm}
        <p className="fine first-voter-link"><Link to="/first-time-voter">{t("First time voting? Three steps to get ready", "¿Va a votar por primera vez? Tres pasos para prepararse")}</Link></p>
        {status !== "done" && <IssuesCard />}
        </>}

      </div>

      <nav className="home-features" aria-label={t("Explore", "Explorar")}>
        {features.map(([to, Drawing, title, line]) => (
          <Link key={to} to={to} className="feature-card">
            <Drawing />
            <strong>{title}</strong>
            <span>{line}</span>
          </Link>
        ))}
      </nav>
      </section>

      {status === "done" && result && <LookupResults result={result} sectionRef={resultsRef} />}
      {status !== "done" && <HomeDashboard />}
    </main>
  );
}
