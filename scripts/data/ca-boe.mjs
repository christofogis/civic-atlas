// California Board of Equalization districts for the address lookup: a small map of the four
// districts from the 2020 Citizens Redistricting Commission's final boundaries, as published by
// the state (services.gis.ca.gov, CaliforniaDistricts). BOE districts don't follow state Senate
// lines (12 of 40 Senate districts are split), so the lookup checks the address's point against
// this map. Output: public/maps/state/ca-boe.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import mapshaper from "mapshaper";

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
const boeLayer = find(/equaliz/i);

const g = await get(`${BASE}/${boeLayer.id}/query?where=1%3D1&outFields=DISTRICT&returnGeometry=true&outSR=4326&f=geojson`);
if (g.features?.length !== 4) throw new Error(`expected 4 BOE districts, got ${g.features?.length}`);
for (const f of g.features) f.properties = { district: Number(String(f.properties.DISTRICT).trim()) };
if (g.features.map((f) => f.properties.district).sort().join() !== "1,2,3,4") throw new Error("BOE district numbers aren't 1-4");
writeFileSync("/tmp/ca-boe-raw.json", JSON.stringify(g));
mkdirSync("public/maps/state", { recursive: true });
const out = "public/maps/state/ca-boe.json";
await mapshaper.runCommands(`-i /tmp/ca-boe-raw.json -simplify 4% keep-shapes -o precision=0.0001 format=geojson ${out}`);
const simple = JSON.parse(readFileSync(out, "utf8"));
writeFileSync(out, JSON.stringify({
  source: "California Citizens Redistricting Commission final maps (2021), via the State of California GIS service",
  source_url: "https://wedrawthelines.ca.gov/final-maps/",
  ...simple,
}));
console.log(`BOE districts: ${simple.features.length}; ${readFileSync(out).length} bytes`);
