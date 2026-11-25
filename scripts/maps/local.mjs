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

// City council districts for every Orange County city that elects by district, from the
// Registrar of Voters' "City Subdistrict" shapefile (Web Mercator; reprojected here). Names
// read like "Anaheim Council District 3"; a name that doesn't parse fails the build.
{
  const url = "https://ocvote.gov/bin/maps/shapefiles/zip/City/City_Subdistrict.zip";
  const zip = "/tmp/rov-city-subdistrict.zip", dir = "/tmp/rov-city-subdistrict";
  const res = await fetch(url, { headers: { "User-Agent": "civic-atlas map build (github.com/christofogis/civic-atlas)" } });
  if (!res.ok) throw new Error(`Registrar city subdistricts: HTTP ${res.status}`);
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  const { execFileSync } = await import("node:child_process");
  execFileSync("unzip", ["-qo", zip, "-d", dir]);
  const shp = execFileSync("sh", ["-c", `ls ${dir}/*.shp ${dir}/*/*.shp 2>/dev/null | head -1`]).toString().trim();
  await mapshaper.runCommands(`-i "${shp}" -proj wgs84 -o /tmp/rov-council.json format=geojson`);
  const raw = JSON.parse(readFileSync("/tmp/rov-council.json", "utf8"));
  const bad = [];
  for (const f of raw.features) {
    const m = /^(.+?) (?:Council District|Ward Division|District|Ward) (\d+)$/.exec(String(f.properties.District).trim());
    if (!m) { bad.push(f.properties.District); continue; }
    f.properties = { city: m[1], district: Number(m[2]) };
  }
  if (bad.length) throw new Error(`unparsed council district names: ${bad.join("; ")}`);
  writeFileSync("/tmp/rov-council.json", JSON.stringify(raw));
  // One small file per city, so the lookup reads only the city an address is in.
  const all = "/tmp/rov-council-simplified.json";
  await mapshaper.runCommands(`-i /tmp/rov-council.json -simplify 20% keep-shapes -o precision=0.000001 format=geojson ${all}`);
  const g = JSON.parse(readFileSync(all, "utf8"));
  const slug = (c) => c.toLowerCase().replace(/[^a-z]+/g, "-");
  mkdirSync("public/maps/local/ca-orange-council", { recursive: true });
  const cities = [...new Set(g.features.map((f) => f.properties.city))];
  for (const c of cities) {
    writeFileSync(`public/maps/local/ca-orange-council/${slug(c)}.json`, JSON.stringify({
      source: "Orange County Registrar of Voters, City Subdistrict shapefile", source_url: url, city: c,
      type: "FeatureCollection", features: g.features.filter((f) => f.properties.city === c),
    }));
  }
  console.log(`council districts: ${g.features.length} in ${cities.length} cities (${cities.join(", ")})`);
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
