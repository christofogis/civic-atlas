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
