// Orange County supervisorial districts for the address lookup and the county page.
// Input: the County of Orange's own GIS layer (OC Public Works, "OC Supervisory Districts"),
// downloaded by build-maps.yml. Output: simplified GeoJSON, about 1/10 the size, with only the
// district number, at public/maps/local/ca-orange-supervisors.json.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import mapshaper from "mapshaper";

const input = process.argv[2];
const raw = JSON.parse(readFileSync(input, "utf8"));
const n = raw.features?.length ?? 0;
if (n !== 5) throw new Error(`expected 5 supervisorial districts, got ${n}`);
mkdirSync("public/maps/local", { recursive: true });
await mapshaper.runCommands(`-i "${input}" -each "district=+DISTRICT" -filter-fields district -simplify 15% keep-shapes -o precision=0.00001 format=geojson public/maps/local/ca-orange-supervisors.json`);
const out = JSON.parse(readFileSync("public/maps/local/ca-orange-supervisors.json", "utf8"));
writeFileSync("public/maps/local/ca-orange-supervisors.json", JSON.stringify({
  source: "County of Orange, OC Public Works GIS: OC Supervisory Districts",
  source_url: "https://services.arcgis.com/UXmFoWC7yDHcDN5Q/ArcGIS/rest/services/OC_Supervisory_Districts/FeatureServer/31",
  ...out,
}));
console.log(`supervisorial districts: ${out.features.map((f) => f.properties.district).join(", ")}; ${readFileSync("public/maps/local/ca-orange-supervisors.json").length} bytes`);

// City council districts. Los Alamitos: the adopted 2022–2031 districts, from the web map that
// the city's districting consultant (National Demographics Corp.) published for the city's
// 2022 redistricting. The layer is embedded in the web map in Web Mercator; convert to lon/lat.
const R = 6378137;
const toLonLat = ([x, y]) => [(x / R) * (180 / Math.PI), (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)];
const signedArea = (ring) => ring.reduce((a, [x1, y1], i) => { const [x2, y2] = ring[(i + 1) % ring.length]; return a + (x1 * y2 - x2 * y1); }, 0) / 2;
// Esri rings: clockwise outer rings, counterclockwise holes (in x/y). Group holes under the outer ring before them.
function esriPolygon(rings) {
  const polys = [];
  for (const ring of rings) {
    const ll = ring.map(toLonLat);
    if (signedArea(ring) <= 0 || !polys.length) polys.push([ll]); else polys[polys.length - 1].push(ll);
  }
  return polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys };
}

const CITIES = [
  { id: "los-alamitos", item: "10f7203ba0f74bd48de0d927cb867c36", layer: /^Adopted Districts/, districts: 5,
    source: "City of Los Alamitos adopted council districts (2022–2031), published by National Demographics Corp. for the city",
    source_url: "https://experience.arcgis.com/experience/118312376df140dbb9f5dff642f7e309" },
];
for (const c of CITIES) {
  const web = await (await fetch(`https://www.arcgis.com/sharing/rest/content/items/${c.item}/data?f=json`)).json();
  const layer = (web.operationalLayers ?? []).find((l) => c.layer.test(l.title ?? ""));
  const features = (layer?.featureCollection?.layers ?? []).flatMap((l) => l.featureSet?.features ?? []);
  if (features.length !== c.districts) throw new Error(`${c.id}: expected ${c.districts} council districts, got ${features.length}`);
  const raw = { type: "FeatureCollection", features: features.map((f) => ({ type: "Feature", properties: { district: Number(f.attributes.DISTRICT) }, geometry: esriPolygon(f.geometry.rings) })) };
  const tmp = `/tmp/${c.id}-council.json`, out = `public/maps/local/ca-orange-${c.id}-council.json`;
  writeFileSync(tmp, JSON.stringify(raw));
  await mapshaper.runCommands(`-i "${tmp}" -simplify 30% keep-shapes -o precision=0.000001 format=geojson "${out}"`);
  const g = JSON.parse(readFileSync(out, "utf8"));
  writeFileSync(out, JSON.stringify({ source: c.source, source_url: c.source_url, ...g }));
  console.log(`${c.id} council districts: ${g.features.map((f) => f.properties.district).join(", ")}; ${readFileSync(out).length} bytes`);
}

// Cities and unincorporated communities (Census places) in Orange County, from the county's
// "OC Land Boundaries for Cities and Unincorporated Supervisory Districts" layer. Tells the
// lookup which city an address is in: mailing addresses don't (Rossmoor mail says "Los Alamitos").
{
  const url = "https://services.arcgis.com/UXmFoWC7yDHcDN5Q/ArcGIS/rest/services/OC_Cities_Land_Boundaries/FeatureServer/0/query?where=1%3D1&outFields=NAME,PlaceType,GEOID&outSR=4326&f=geojson";
  const raw = await (await fetch(url)).json();
  if (!(raw.features?.length > 30)) throw new Error(`expected Orange County places, got ${raw.features?.length}`);
  console.log("place types:", [...new Set(raw.features.map((f) => f.properties.PlaceType))].join(", "));
  writeFileSync("/tmp/oc-places.json", JSON.stringify(raw));
  const out = "public/maps/local/ca-orange-places.json";
  await mapshaper.runCommands(`-i /tmp/oc-places.json -each "name=NAME, type=PlaceType, geoid=GEOID" -filter-fields name,type,geoid -simplify 10% keep-shapes -o precision=0.00001 format=geojson ${out}`);
  const g = JSON.parse(readFileSync(out, "utf8"));
  writeFileSync(out, JSON.stringify({ source: "County of Orange, OC Public Works GIS: OC Land Boundaries for Cities and Unincorporated Supervisory Districts", source_url: "https://services.arcgis.com/UXmFoWC7yDHcDN5Q/ArcGIS/rest/services/OC_Cities_Land_Boundaries/FeatureServer/0", ...g }));
  console.log(`places: ${g.features.length}; ${readFileSync(out).length} bytes`);
}
