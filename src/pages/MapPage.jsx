import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { feature } from "topojson-client";
import { db } from "../lib/db.js";
import { stateName, ordinal } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { congressOn } from "../../lib/congress.js";
import { myRepresentatives } from "../lib/myReps.js";
import { PartyTag } from "../components/PartyTag.jsx";

// Interactive map: states, congressional districts (current lines, or the lines that take effect
// with the next Congress), zooming down to streets. Districts are drawn in one neutral color;
// party appears only on names, as everywhere on the site. The state list under the map is the
// keyboard and screen-reader way to do everything the map does.
const BASEMAP = "https://tiles.openfreemap.org/styles/positron";
const CURRENT = congressOn();
// District files built so far (scripts/maps/build.mjs). The toggle offers the neighbors of the current Congress that exist.
const AVAILABLE = [119, 120];
const OTHER = AVAILABLE.includes(CURRENT + 1) ? CURRENT + 1 : AVAILABLE.includes(CURRENT - 1) ? CURRENT - 1 : null;
const ACCENT = "#0e5a4b", MARK = "#f4d35e", LINE = "#1b2420";
const AT_LARGE = new Set(["AK", "DE", "ND", "SD", "VT", "WY", "DC", "PR", "GU", "VI", "AS", "MP"]);

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
    setParams(v?.st ? { state: v.st, ...(v.cd != null ? { district: String(v.cd) } : {}) } : {}, { replace: true });
  };
  const [people, setPeople] = useState([]);      // members for the selected state
  const mine = useMemo(() => myRepresentatives(), []);
  const [myDistrict, setMyDistrict] = useState(null);

  // Districts of the visitor's own representative (remembered from a lookup on this device), highlighted.
  useEffect(() => {
    if (!mine.size) return;
    db.from("member_directory").select("state,district,chamber").in("bioguide_id", [...mine]).eq("chamber", "house").limit(1)
      .then(({ data }) => data?.[0] && setMyDistrict({ st: data[0].state, cd: data[0].district ?? 0 }));
  }, [mine]);

  useEffect(() => { fetch("/maps/meta.json").then((r) => r.json()).then(setMeta).catch(() => {}); }, []);

  // Create the map once.
  useEffect(() => {
    let m;
    try {
      m = new maplibregl.Map({ container: box.current, style: BASEMAP, bounds: [[-125, 24], [-66.5, 49.5]], fitBoundsOptions: { padding: 10 }, minZoom: 2, maxZoom: 16,
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
        m.addLayer({ id: `${src}-fill`, type: "fill", source: src, paint: { "fill-color": ACCENT,
          "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.28, ["boolean", ["feature-state", "hover"], false], 0.14, ["boolean", ["feature-state", "mine"], false], 0.0, 0.03] } });
        m.addLayer({ id: `${src}-mine`, type: "line", source: src, paint: { "line-color": MARK, "line-width": ["case", ["boolean", ["feature-state", "mine"], false], 4, 0] } });
        m.addLayer({ id: `${src}-line`, type: "line", source: src, paint: { "line-color": LINE, "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.4, 8, 1.2] } });
      }
      m.addLayer({ id: "states-line", type: "line", source: "states", paint: { "line-color": LINE, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.1, 8, 2.4] } });
      setReady(true);
    });
    let hovered = null;
    const hit = (e) => m.queryRenderedFeatures(e.point, { layers: ["detail-fill", "districts-fill"] })[0];
    m.on("mousemove", (e) => {
      const f = hit(e);
      if (hovered) m.setFeatureState(hovered, { hover: false });
      hovered = f ? { source: f.source, id: f.id } : null;
      if (hovered) m.setFeatureState(hovered, { hover: true });
      m.getCanvas().style.cursor = f ? "pointer" : "";
    });
    m.on("click", (e) => {
      const f = hit(e);
      if (f) setSel({ st: f.properties.st, cd: f.properties.cd, zoom: false });
    });
    return () => m.remove();
  }, []);

  // District lines for the chosen Congress.
  useEffect(() => {
    if (!ready) return;
    loadTopo(`/maps/cd${congress}/us.json`).then((g) => {
      map.current.getSource("districts").setData(g);
      if (myDistrict) g.features.forEach((f, i) => f.properties.st === myDistrict.st && f.properties.cd === myDistrict.cd
        && map.current.setFeatureState({ source: "districts", id: i }, { mine: true }));
    }).catch(() => setFailed(true));
  }, [ready, congress, myDistrict]);

  // Selecting a state: zoom to it, swap in its detailed lines, load its members.
  useEffect(() => {
    if (!ready || !sel?.st) return;
    const m = map.current;
    loadTopo(`/maps/cd${congress}/${sel.st}.json`).then((g) => {
      m.getSource("detail").setData(g);
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
      </div>
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
            <p>{tr(`Members elected in November take office on January 3. Their records appear here once they're sworn in.`, `Los miembros elegidos en noviembre asumen el cargo el 3 de enero. Sus registros aparecerán aquí cuando juren el cargo.`)}</p>
          ) : (
            <>
              {sel.cd != null && house.filter((p) => (p.district ?? 0) === sel.cd).map((p) => (
                <p key={p.bioguide_id} className="map-rep">
                  {tr("Represented in the House by", "Representado en la Cámara por")} <Link to={`/member/${p.bioguide_id}`}><strong>{p.name}</strong></Link> <PartyTag p={p} />
                </p>
              ))}
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
