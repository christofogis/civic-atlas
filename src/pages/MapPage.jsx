import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { feature } from "topojson-client";
import { db } from "../lib/db.js";
import { stateName, ordinal } from "../lib/format.js";
import { locale, tr } from "../lib/lang.js";
import { congressOn } from "../../lib/congress.js";
import { myRepresentatives } from "../lib/myReps.js";
import { PartyTag } from "../components/PartyTag.jsx";
import { DistrictFacts, placeList } from "../components/DistrictFacts.jsx";
import { partyTag } from "../lib/format.js";

// Interactive map: states, congressional districts (current lines, or the lines that take effect
// with the next Congress), zooming down to streets. Districts are drawn in one neutral color;
// party appears only on names, as everywhere on the site. The state list under the map is the
// keyboard and screen-reader way to do everything the map does.
// Base map and line colors follow the site's light or dark theme, chosen when the map opens.
// OpenFreeMap's dark style is the Dark Matter style it hosts beside Positron.
const isDark = () => document.documentElement.dataset.theme === "dark"
  || (!document.documentElement.dataset.theme && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches));
const THEME = {
  light: { basemap: "https://tiles.openfreemap.org/styles/positron", accent: "#0e5a4b", line: "#1b2420", vacant: "#d9dedb" },
  dark: { basemap: "https://tiles.openfreemap.org/styles/dark", accent: "#6fcaa8", line: "#e4ebe8", vacant: "#3a4440" },
};
const CURRENT = congressOn();
// District files built so far (scripts/maps/build.mjs). The toggle offers the neighbors of the current Congress that exist.
const AVAILABLE = [119, 120];
const OTHER = AVAILABLE.includes(CURRENT + 1) ? CURRENT + 1 : AVAILABLE.includes(CURRENT - 1) ? CURRENT - 1 : null;
const MARK = "#f4d35e";
// Same colors as the party badges: D blue, R red, independents and others neutral grey; vacant seats pale.
const PARTY_FILL = { d: "#1f4e9c", r: "#b42318", other: "#5b6470" };
const AT_LARGE = new Set(["AK", "DE", "ND", "SD", "VT", "WY", "DC", "PR", "GU", "VI", "AS", "MP"]);

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const KIND = { Democrat: "d", Republican: "r" };
// Census figures exist for the 119th Congress lines. For the next Congress they still apply
// in states whose lines didn't change.
const factsFor = (facts, meta, congress, st, cd) =>
  facts && (congress === 119 || (congress === 120 && meta?.changed120 && !meta.changed120.includes(st))) ? facts.districts[`${st}-${cd ?? 0}`] : null;

const loadTopo = async (url) => {
  const topo = await (await fetch(url)).json();
  return feature(topo, Object.values(topo.objects)[0]);
};
const bbox = (geo) => {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (c) => (typeof c[0] === "number" ? (b = [Math.min(b[0], c[0]), Math.min(b[1], c[1]), Math.max(b[2], c[0]), Math.max(b[3], c[1])]) : c.forEach(walk));
  for (const f of geo.features ?? [geo]) walk(f.geometry.coordinates);
  // Alaska's Aleutians cross the date line; keep the view on the mainland.
  if (b[2] - b[0] > 180) b = [-180, b[1], -129, b[3]];
  return [[b[0], b[1]], [b[2], b[3]]];
};
const districtName = (st, cd) => (cd === 0 || AT_LARGE.has(st)
  ? tr(`${stateName(st)} at-large`, `${stateName(st)}, distrito único`)
  : tr(`${stateName(st)} District ${cd}`, `${stateName(st)}, distrito ${cd}`));

export default function MapPage() {
  const box = useRef(null);
  const map = useRef(null);
  const colors = useRef(THEME.light);
  // Rebuild the map when the theme changes (the header switch, or the device's setting).
  const [themeKey, setThemeKey] = useState(() => (isDark() ? "dark" : "light"));
  useEffect(() => {
    const check = () => setThemeKey(isDark() ? "dark" : "light");
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    window.addEventListener("civic-atlas:theme", check);
    mq?.addEventListener?.("change", check);
    return () => { window.removeEventListener("civic-atlas:theme", check); mq?.removeEventListener?.("change", check); };
  }, []);
  const statesGeo = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [meta, setMeta] = useState(null);
  const [congress, setCongress] = useState(CURRENT);
  const [params, setParams] = useSearchParams();
  // ?state=CA&district=12 opens a state or district, so a view can be linked to.
  const [sel, setSelState] = useState(() => {
    const st = (params.get("state") ?? "").toUpperCase();
    const cd = params.get("district");
    return /^[A-Z]{2}$/.test(st) ? { st, cd: cd != null && /^\d+$/.test(cd) ? Number(cd) : undefined } : null;
  });
  const setSel = (v) => {
    setSelState(v);
    setParams({ ...(v?.st ? { state: v.st, ...(v.cd != null ? { district: String(v.cd) } : {}) } : {}), ...(byParty ? { color: "party" } : {}) }, { replace: true });
  };
  const [people, setPeople] = useState([]);      // members for the selected state
  const mine = useMemo(() => myRepresentatives(), []);
  const [myDistrict, setMyDistrict] = useState(null);
  const [facts, setFacts] = useState(null);
  // Opt-in: color each district by the party of its current representative. Off by default.
  const [byParty, setByParty] = useState(() => params.get("color") === "party");
  const [repsLoaded, setRepsLoaded] = useState(false);
  // Every serving House member, for the hover snapshot (about 440 rows).
  const reps = useRef(new Map());
  const live = useRef({});   // latest values for map event handlers
  live.current = { facts, meta, congress, future: congress > CURRENT };

  // Districts of the visitor's own representative (remembered from a lookup on this device), highlighted.
  useEffect(() => {
    if (!mine.size) return;
    db.from("member_directory").select("state,district,chamber").in("bioguide_id", [...mine]).eq("chamber", "house").limit(1)
      .then(({ data }) => data?.[0] && setMyDistrict({ st: data[0].state, cd: data[0].district ?? 0 }));
  }, [mine]);

  useEffect(() => { fetch("/maps/meta.json").then((r) => r.json()).then(setMeta).catch(() => {}); }, []);
  useEffect(() => { fetch("/maps/cd119/facts.json").then((r) => r.json()).then(setFacts).catch(() => {}); }, []);
  useEffect(() => {
    db.from("member_directory").select("bioguide_id,name,chamber,state,district,party").eq("chamber", "house").eq("serving", true)
      .then(({ data }) => { reps.current = new Map((data ?? []).map((p) => [`${p.state}-${p.district ?? 0}`, p])); setRepsLoaded(true); });
  }, []);

  // Create the map once.
  useEffect(() => {
    let m;
    setReady(false);
    const theme = THEME[themeKey];
    colors.current = theme;
    try {
      m = new maplibregl.Map({ container: box.current, style: theme.basemap, bounds: [[-125, 24], [-66.5, 49.5]], fitBoundsOptions: { padding: 10 }, minZoom: 2, maxZoom: 16,
        attributionControl: { compact: true }, cooperativeGestures: true });
    } catch { setFailed(true); return undefined; }
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("error", (e) => { if (!m.isStyleLoaded()) setFailed(Boolean(e)); });
    m.on("load", async () => {
      statesGeo.current = await loadTopo("/maps/states.json");
      m.addSource("states", { type: "geojson", data: statesGeo.current });
      m.addSource("districts", { type: "geojson", data: { type: "FeatureCollection", features: [] }, generateId: true });
      m.addSource("detail", { type: "geojson", data: { type: "FeatureCollection", features: [] }, generateId: true });
      for (const src of ["districts", "detail"]) {
        const party = ["coalesce", ["feature-state", "party"], ""];
        m.addLayer({ id: `${src}-fill`, type: "fill", source: src, paint: {
          "fill-color": ["match", party, "d", PARTY_FILL.d, "r", PARTY_FILL.r, "other", PARTY_FILL.other, "vacant", theme.vacant, theme.accent],
          "fill-opacity": ["case", ["!=", party, ""],
            ["case", ["boolean", ["feature-state", "selected"], false], 0.95, ["boolean", ["feature-state", "hover"], false], 0.85, 0.62],
            ["case", ["boolean", ["feature-state", "selected"], false], 0.28, ["boolean", ["feature-state", "hover"], false], 0.14, ["boolean", ["feature-state", "mine"], false], 0.0, 0.03]] } });
        m.addLayer({ id: `${src}-mine`, type: "line", source: src, paint: { "line-color": MARK, "line-width": ["case", ["boolean", ["feature-state", "mine"], false], 4, 0] } });
        m.addLayer({ id: `${src}-line`, type: "line", source: src, paint: { "line-color": theme.line, "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 8, 1.2] } });
      }
      m.addLayer({ id: "states-line", type: "line", source: "states", paint: { "line-color": theme.line, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.1, 8, 2.4] } });
      setReady(true);
    });
    let hovered = null;
    // Snapshot that follows the pointer on devices with a mouse; on touch screens a tap opens the panel below.
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "map-tip", maxWidth: "260px", offset: 14 });
    const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
    const snapshot = (st, cd) => {
      const { facts: fx, meta: mt, congress: c, future } = live.current;
      const f = factsFor(fx, mt, c, st, cd);
      const rep = future ? null : reps.current.get(`${st}-${cd ?? 0}`);
      let html = `<strong>${esc(districtName(st, cd))}</strong>`;
      if (rep) html += `<div class="map-tip-rep">${esc(rep.name)} <span class="party party-${KIND[rep.party] ?? "other"}">${esc(partyTag(rep))}</span></div>`;
      else if (future) html += `<div class="map-tip-rep">${esc(tr("New lines; members take office Jan. 3", "Líneas nuevas; los miembros asumen el 3 de enero"))}</div>`;
      if (f) {
        html += `<div>${esc(tr("Population", "Población"))} ${esc(f.population?.toLocaleString(locale()) ?? "—")}</div>`;
        if (f.places.length) html += `<div>${esc(placeList(f.places))}</div>`;
      }
      return html + `<div class="map-tip-hint">${esc(tr("Click for details", "Haga clic para ver detalles"))}</div>`;
    };
    const hit = (e) => m.queryRenderedFeatures(e.point, { layers: ["detail-fill", "districts-fill"] })[0];
    m.on("mousemove", (e) => {
      const f = hit(e);
      const same = f && hovered && f.source === hovered.source && f.id === hovered.id;
      if (!same) {
        if (hovered) m.setFeatureState(hovered, { hover: false });
        hovered = f ? { source: f.source, id: f.id } : null;
        if (hovered) m.setFeatureState(hovered, { hover: true });
        if (f && fine) tip.setHTML(snapshot(f.properties.st, f.properties.cd));
      }
      m.getCanvas().style.cursor = f ? "pointer" : "";
      if (f && fine) tip.setLngLat(e.lngLat).addTo(m); else tip.remove();
    });
    m.getCanvas().addEventListener("mouseleave", () => {
      tip.remove();
      if (hovered) m.setFeatureState(hovered, { hover: false });
      hovered = null;
    });
    m.on("click", (e) => {
      const f = hit(e);
      if (f) setSel({ st: f.properties.st, cd: f.properties.cd, zoom: false });
    });
    return () => m.remove();
  }, [themeKey]);

  // Party coloring: set or clear each district's party feature-state.
  const paintParty = (source, features) => {
    const on = byParty && congress <= CURRENT && repsLoaded;
    features.forEach((f, i) => {
      const rep = reps.current.get(`${f.properties.st}-${f.properties.cd ?? 0}`);
      map.current.setFeatureState({ source, id: i }, { party: on ? (rep ? KIND[rep.party] ?? "other" : "vacant") : "" });
    });
  };
  const loaded = useRef({ districts: [], detail: [] });
  useEffect(() => {
    if (!ready) return;
    paintParty("districts", loaded.current.districts);
    paintParty("detail", loaded.current.detail);
    map.current.setPaintProperty("districts-line", "line-color", byParty && congress <= CURRENT ? "#ffffff" : colors.current.line);
    map.current.setPaintProperty("detail-line", "line-color", byParty && congress <= CURRENT ? "#ffffff" : colors.current.line);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, byParty, repsLoaded, congress]);

  // District lines for the chosen Congress.
  useEffect(() => {
    if (!ready) return;
    loadTopo(`/maps/cd${congress}/us.json`).then((g) => {
      map.current.getSource("districts").setData(g);
      loaded.current.districts = g.features;
      paintParty("districts", g.features);
      if (myDistrict) g.features.forEach((f, i) => f.properties.st === myDistrict.st && f.properties.cd === myDistrict.cd
        && map.current.setFeatureState({ source: "districts", id: i }, { mine: true }));
    }).catch(() => setFailed(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, congress, myDistrict]);

  // Selecting a state: zoom to it, swap in its detailed lines, load its members.
  useEffect(() => {
    if (!ready || !sel?.st) return;
    const m = map.current;
    loadTopo(`/maps/cd${congress}/${sel.st}.json`).then((g) => {
      m.getSource("detail").setData(g);
      loaded.current.detail = g.features;
      paintParty("detail", g.features);
      m.setFilter("districts-fill", ["!=", ["get", "st"], sel.st]);
      m.setFilter("districts-line", ["!=", ["get", "st"], sel.st]);
      m.setFilter("districts-mine", ["!=", ["get", "st"], sel.st]);
      g.features.forEach((f, i) => {
        m.setFeatureState({ source: "detail", id: i }, { selected: sel.cd != null && f.properties.cd === sel.cd,
          mine: Boolean(myDistrict && f.properties.st === myDistrict.st && f.properties.cd === myDistrict.cd) });
      });
      if (sel.zoom !== false) {
        const target = sel.cd != null ? { features: g.features.filter((f) => f.properties.cd === sel.cd) } : statesGeo.current.features.find((f) => f.properties.st === sel.st);
        if (target && (target.features?.length ?? 1)) m.fitBounds(bbox(target), { padding: 30, maxZoom: 11 });
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sel, congress, myDistrict]);

  useEffect(() => {
    if (!sel?.st) { setPeople([]); return; }
    db.from("member_directory").select("bioguide_id,name,chamber,state,district,party,serving")
      .eq("state", sel.st).eq("serving", true).order("district").then(({ data }) => setPeople(data ?? []));
  }, [sel?.st]);

  const senators = people.filter((p) => p.chamber === "senate");
  const house = people.filter((p) => p.chamber === "house");
  const future = congress > CURRENT;
  const past = congress < CURRENT;
  const selFacts = sel?.st && sel.cd != null ? factsFor(facts, meta, congress, sel.st, sel.cd) : null;

  return (
    <main className="page wide map-page">
      <h1>{tr("Map", "Mapa")}</h1>
      <p className="lede">
        {tr("Every state elects two senators. Each state is also divided into House districts of about 760,000 people, and each district elects one representative. Tap a district, or choose a state below.",
          "Cada estado elige dos senadores. Además, cada estado se divide en distritos de la Cámara de unas 760,000 personas, y cada distrito elige a un representante. Toque un distrito o elija un estado abajo.")}
      </p>

      <div className="filters">
        <div className="toggle" role="group" aria-label={tr("Which district lines", "Qué líneas de distrito")}>
          <button type="button" aria-pressed={congress === CURRENT} className={congress === CURRENT ? "on" : ""} onClick={() => setCongress(CURRENT)}>
            {tr(`Current districts (${ordinal(CURRENT)} Congress)`, `Distritos actuales (${ordinal(CURRENT)} Congreso)`)}
          </button>
          {OTHER && (
            <button type="button" aria-pressed={congress === OTHER} className={congress === OTHER ? "on" : ""} onClick={() => setCongress(OTHER)}>
              {OTHER > CURRENT ? tr(`Next Congress (${ordinal(OTHER)})`, `Próximo Congreso (${ordinal(OTHER)})`) : tr(`Previous lines (${ordinal(OTHER)})`, `Líneas anteriores (${ordinal(OTHER)})`)}
            </button>
          )}
        </div>
        <label>{tr("State", "Estado")}{" "}
          <select value={sel?.st ?? ""} onChange={(e) => setSel(e.target.value ? { st: e.target.value } : null)}>
            <option value="">{tr("Choose a state", "Elija un estado")}</option>
            {(statesGeo.current?.features ?? []).map((f) => f.properties.st).sort((a, z) => stateName(a).localeCompare(stateName(z)))
              .map((st) => <option key={st} value={st}>{stateName(st)}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={byParty && !future} disabled={future}
            onChange={(e) => {
              setByParty(e.target.checked);
              const next = new URLSearchParams(params);
              if (e.target.checked) next.set("color", "party"); else next.delete("color");
              setParams(next, { replace: true });
            }} />{" "}
          {tr("Color districts by party of the current representative", "Colorear los distritos según el partido del representante actual")}
        </label>
      </div>
      {byParty && !future && (
        <div className="fine map-legend">
          {[["d", tr("D: Democrat", "D: Demócrata")], ["r", tr("R: Republican", "R: Republicano")], ["other", tr("Independent or other", "Independiente u otro")], ["vacant", tr("Vacant", "Vacante")]].map(([k, label]) => (
            <span key={k} className="map-legend-item"><span className="swatch" style={{ background: k === "vacant" ? colors.current.vacant : PARTY_FILL[k] }} aria-hidden="true" />{label}</span>
          ))}
          <p className="fine">{tr("Shows who holds each seat today, not vote margins. Hover or tap a district for its representative's name and party letter.",
            "Muestra quién ocupa cada escaño hoy, no márgenes de votación. Pase el cursor o toque un distrito para ver el nombre y la letra del partido de su representante.")}</p>
        </div>
      )}
      {future && meta?.changed120 && (
        <p className="notice">
          {tr(`These lines take effect when the ${ordinal(CURRENT + 1)} Congress begins on January 3, ${CURRENT === 119 ? 2027 : ""}. States with new lines: `,
            `Estas líneas entran en vigor cuando comience el ${ordinal(CURRENT + 1)} Congreso, el 3 de enero de ${CURRENT === 119 ? 2027 : ""}. Estados con líneas nuevas: `)}
          {meta.changed120.map((st, i) => <span key={st}>{i ? ", " : ""}<button type="button" className="link" onClick={() => setSel({ st })}>{stateName(st)}</button></span>)}.
        </p>
      )}

      <div className="map-wrap">
        <div ref={box} className="map-canvas" role="region" aria-label={tr("Map of states and congressional districts", "Mapa de estados y distritos del Congreso")} />
        {failed && <p className="notice map-failed">{tr("The map couldn't load. The state list still works.", "El mapa no se pudo cargar. La lista de estados sigue funcionando.")}</p>}
      </div>
      {myDistrict && <p className="fine"><span className="swatch-mine" aria-hidden="true" /> {tr("Outlined in yellow: your district, from your last lookup on this device.", "Contorno amarillo: su distrito, según su última búsqueda en este dispositivo.")}</p>}

      {sel?.st && (
        <section className="section map-panel" aria-live="polite">
          <h2>{sel.cd != null ? districtName(sel.st, sel.cd) : stateName(sel.st)}</h2>
          {future ? (
            <>
              <p>{tr(`Members elected in November take office on January 3. Their records appear here once they're sworn in.`, `Los miembros elegidos en noviembre asumen el cargo el 3 de enero. Sus registros aparecerán aquí cuando juren el cargo.`)}</p>
              {selFacts && <DistrictFacts f={selFacts} years={facts.years} />}
              {sel.cd != null && !selFacts && facts && future && (
                <p className="fine">{tr("The Census Bureau hasn't published figures for this state's new lines yet.", "La Oficina del Censo aún no ha publicado cifras para las nuevas líneas de este estado.")}</p>
              )}
            </>
          ) : (
            <>
              {sel.cd != null && house.filter((p) => (p.district ?? 0) === sel.cd).map((p) => (
                <p key={p.bioguide_id} className="map-rep">
                  {tr("Represented in the House by", "Representado en la Cámara por")} <Link to={`/member/${p.bioguide_id}`}><strong>{p.name}</strong></Link> <PartyTag p={p} />
                </p>
              ))}
              {selFacts && <DistrictFacts f={selFacts} years={facts.years} />}
              {past && <p className="fine">{tr(`These are the ${ordinal(congress)} Congress's lines; the members listed are those serving now.`, `Estas son las líneas del ${ordinal(congress)} Congreso; los miembros que se muestran son los que están en el cargo ahora.`)}</p>}
              <h3 className="small">{tr("Senators (whole state)", "Senadores (todo el estado)")}</h3>
              <ul className="plain">{senators.map((p) => <li key={p.bioguide_id}><Link to={`/member/${p.bioguide_id}`}>{p.name}</Link> <PartyTag p={p} /></li>)}</ul>
              <h3 className="small">{tr("House", "Cámara de Representantes")}</h3>
              <ul className="plain columns">
                {house.map((p) => (
                  <li key={p.bioguide_id} className={sel.cd != null && (p.district ?? 0) === sel.cd ? "map-current" : ""}>
                    <button type="button" className="link fine" onClick={() => setSel({ st: sel.st, cd: p.district ?? 0 })}>
                      {AT_LARGE.has(sel.st) || !p.district ? tr("At-large", "Distrito único") : tr(`District ${p.district}`, `Distrito ${p.district}`)}
                    </button>{" "}
                    <Link to={`/member/${p.bioguide_id}`}>{p.name}</Link> <PartyTag p={p} />
                  </li>
                ))}
              </ul>
              {house.length === 0 && senators.length === 0 && <p className="fine">{tr("Loading…", "Cargando…")}</p>}
              {sel.cd != null && !house.some((p) => (p.district ?? 0) === sel.cd) && house.length > 0 && (
                <p className="fine">{tr("This seat is vacant or its new member is being added.", "Este escaño está vacante o se está agregando a su nuevo miembro.")}</p>
              )}
            </>
          )}
        </section>
      )}

      <p className="fine">
        {tr("District lines: U.S. Census Bureau boundary files", "Líneas de distrito: archivos de límites de la Oficina del Censo de EE. UU.")}
        {meta?.built && tr(` (built ${meta.built})`, ` (generados el ${meta.built})`)}. {tr("Street map: OpenFreeMap, © OpenStreetMap contributors. Lines are simplified for display; to confirm your district, ", "Mapa de calles: OpenFreeMap, © colaboradores de OpenStreetMap. Las líneas se simplifican para mostrarlas; para confirmar su distrito, ")}
        <Link to="/">{tr("look up your address", "busque su dirección")}</Link>.
      </p>
    </main>
  );
}
