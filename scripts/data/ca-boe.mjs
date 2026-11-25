// California Board of Equalization districts, as a table of state Senate district -> BOE district.
// The 2020 Citizens Redistricting Commission drew each BOE district from whole Senate districts
// (ten each), so the Senate district the address lookup already has is enough to find the BOE
// district; no extra map in the lookup. This script derives the table from the Commission's
// final boundaries as published by the state (services.gis.ca.gov, CaliforniaDistricts) and
// fails if any Senate district is split between BOE districts or a BOE district doesn't hold ten.
// Output: public/data/state/ca-boe-districts.json
import { writeFileSync } from "node:fs";

const BASE = "https://services.gis.ca.gov/arcgis/rest/services/Government/CaliforniaDistricts/MapServer";
const UA = { "User-Agent": "civic-atlas data build (github.com/christofogis/civic-atlas)" };
const get = async (url) => {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
};

const { layers } = await get(`${BASE}/layers?f=json`);
console.log("layers:", layers.map((l) => `${l.id} ${l.name}`).join("; "));
const find = (re) => {
  const l = layers.filter((x) => x.type === "Feature Layer" && re.test(x.name));
  if (l.length !== 1) throw new Error(`expected one layer matching ${re}, found ${l.map((x) => x.name).join(", ") || "none"}`);
  return l[0];
};
const boeLayer = find(/equaliz/i), senLayer = find(/senate/i);

async function features(layer) {
  const g = await get(`${BASE}/${layer.id}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson`);
  if (!g.features?.length) throw new Error(`${layer.name}: no features`);
  const props = Object.keys(g.features[0].properties);
  const field = props.find((p) => /^district$/i.test(p)) ?? props.find((p) => /dist/i.test(p) && /^\d+$/.test(String(g.features[0].properties[p]).trim()));
  if (!field) throw new Error(`${layer.name}: no district field in ${props.join(", ")}`);
  console.log(`${layer.name}: ${g.features.length} features, district field ${field}`);
  return g.features.map((f) => ({ district: Number(String(f.properties[field]).trim()), geometry: f.geometry }));
}
const boe = await features(boeLayer), senate = await features(senLayer);
if (boe.length !== 4) throw new Error(`expected 4 BOE districts, got ${boe.length}`);
if (senate.length !== 40) throw new Error(`expected 40 Senate districts, got ${senate.length}`);

// Point in polygon (even-odd over all rings), for Polygon and MultiPolygon.
const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);
const inRing = ([x, y], ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inside = (pt, g) => polys(g).some((rings) => rings.reduce((acc, r) => (inRing(pt, r) ? !acc : acc), false));
const bbox = (g) => {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const rings of polys(g)) for (const [x, y] of rings[0]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
};

// Sample a grid of points inside each Senate district and see which BOE district holds them.
// Boundaries are the same lines in both layers, so nearly every point should land in one.
const table = {}, problems = [];
for (const s of senate.sort((a, b) => a.district - b.district)) {
  const [x0, y0, x1, y1] = bbox(s.geometry);
  const counts = new Map();
  let n = 0;
  for (let i = 0; i < 80; i++) for (let j = 0; j < 80; j++) {
    const pt = [x0 + ((i + 0.5) / 80) * (x1 - x0), y0 + ((j + 0.5) / 80) * (y1 - y0)];
    if (!inside(pt, s.geometry)) continue;
    n++;
    const b = boe.find((d) => inside(pt, d.geometry))?.district ?? 0;
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  const [best, hits] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];
  const share = n ? hits / n : 0;
  if (!best || share < 0.99) problems.push(`Senate ${s.district}: ${[...counts].map(([b, c]) => `BOE ${b || "none"} ${c}`).join(", ")} of ${n} points`);
  table[s.district] = best;
}
const per = [1, 2, 3, 4].map((b) => Object.values(table).filter((x) => x === b).length);
if (per.some((c) => c !== 10)) problems.push(`Senate districts per BOE district: ${per.join(", ")} (expected 10 each)`);
if (problems.length) throw new Error(`Senate districts don't nest in BOE districts:\n${problems.join("\n")}`);

writeFileSync("public/data/state/ca-boe-districts.json", JSON.stringify({
  note: "California Board of Equalization district for each state Senate district. Each BOE district is made of ten whole Senate districts (2020 Citizens Redistricting Commission final maps). Derived by scripts/data/ca-boe.mjs.",
  source: "California Citizens Redistricting Commission final maps, via the State of California GIS service (CaliforniaDistricts)",
  source_url: "https://wedrawthelines.ca.gov/final-maps/",
  senate_to_boe: table,
}, null, 1) + "\n");
console.log("BOE districts:", [1, 2, 3, 4].map((b) => `${b}: SD ${Object.keys(table).filter((k) => table[k] === b).join(",")}`).join(" | "));
