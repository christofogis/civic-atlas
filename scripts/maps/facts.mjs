// District facts for the map: Census Bureau American Community Survey (ACS) 5-year estimates for
// each congressional district (119th Congress lines), the counties it includes, and its largest
// cities and towns. Writes public/maps/cd119/facts.json. Inputs are downloaded to $GEO_DIR by
// .github/workflows/build-maps.yml (keyless Census files; no API key).
//   GEO_DIR=/tmp/geo node scripts/maps/facts.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import mapshaper from "mapshaper";

const GEO = process.env.GEO_DIR ?? "/tmp/geo";
const ACS_YEARS = process.env.ACS_YEARS ?? "2020–2024";
const FIPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY", "72": "PR",
};

// One ACS table file: GEO_ID|B01003_E001|B01003_M001|... -> Map(GEO_ID -> {column: number})
function table(name) {
  const [head, ...lines] = readFileSync(join(GEO, "acs", `acsdt5y2024-${name}.dat`), "utf8").trim().split("\n");
  const cols = head.split("|");
  const out = new Map();
  for (const line of lines) {
    const v = line.split("|");
    if (!/^(500|510|160)/.test(v[0])) continue;
    const row = {};
    cols.forEach((c, i) => { if (i && /_E\d+$/.test(c)) row[c] = Number(v[i]); });
    out.set(v[0], row);
  }
  return out;
}
// ACS marks unavailable values with large negative numbers.
const ok = (n) => (Number.isFinite(n) && n >= 0 ? n : null);
const key = (st, cd) => `${FIPS[st]}-${cd}`;
// "00" at-large, "98" non-voting delegate; "ZZ" (water, no district) is skipped.
const cdOf = (code) => (code === "00" || code === "98" ? 0 : /^\d+$/.test(code) ? Number(code) : null);

const names = new Map();   // GEO_ID -> name, from the ACS geography file
for (const line of readFileSync(join(GEO, "acs", "Geos20245YR.txt"), "utf8").split("\n")) {
  const f = line.split("|");
  if (f[2] === "510" || f[2] === "160") names.set(f[40], f[41]);
}

const pop = table("b01003"), age = table("b01002"), income = table("b19013"), home = table("b25077"),
  edu = table("b15003"), pov = table("b17001");
const facts = {};
for (const [id, p] of pop) {
  if (!id.startsWith("5001900US")) continue;
  const st = id.slice(9, 11), cd = id.slice(11, 13);
  if (!FIPS[st] || cdOf(cd) == null) continue;
  const e = edu.get(id), v = pov.get(id);
  const ba = e && e.B15003_E001 ? (e.B15003_E022 + e.B15003_E023 + e.B15003_E024 + e.B15003_E025) / e.B15003_E001 : null;
  facts[key(st, cdOf(cd))] = {
    population: ok(p.B01003_E001),
    median_age: ok(age.get(id)?.B01002_E001),
    median_household_income: ok(income.get(id)?.B19013_E001),
    median_home_value: ok(home.get(id)?.B25077_E001),
    bachelors_or_higher: ba == null ? null : Math.round(ba * 1000) / 10,
    below_poverty: v && v.B17001_E001 ? Math.round((v.B17001_E002 / v.B17001_E001) * 1000) / 10 : null,
    counties: [],
    places: [],
  };
}

// Counties in each district, with the population of the part inside it.
for (const [id, p] of pop) {
  if (!id.startsWith("5101900US")) continue;
  const st = id.slice(9, 11), cd = id.slice(11, 13);
  const f = facts[key(st, cdOf(cd))];
  const name = (names.get(id) ?? "").split(",")[0].replace(/ \(part\)$/, "");
  const people = ok(p.B01003_E001);
  if (f && name && people) f.counties.push({ name, population: people });
}

// Largest cities and towns: places whose center point falls inside the district.
const gazDir = join(GEO, "gazetteer");
const gaz = readFileSync(join(gazDir, readdirSync(gazDir).find((n) => /place.*\.txt$/i.test(n))), "utf8").trim().split("\n");
// The 2025 Gazetteer is pipe-separated; earlier years used tabs.
const SEP = gaz[0].includes("|") ? "|" : "\t";
const gh = gaz[0].replace(/^\uFEFF/, "").split(SEP).map((s) => s.trim());
const gi = (n) => { const i = gh.findIndex((h) => h.toUpperCase() === n); if (i < 0) throw new Error(`Gazetteer column ${n} not in: ${gh.join(", ")}`); return i; };
const [G_ID, G_NAME, G_LON, G_LAT] = ["GEOID", "NAME", "INTPTLONG", "INTPTLAT"].map(gi);
const rows = ["geoid,name,lon,lat,population"];
const placeName = new Map();
for (const line of gaz.slice(1)) {
  const f = line.split(SEP).map((s) => s.trim());
  const geoid = f[G_ID], p = ok(pop.get(`1600000US${geoid}`)?.B01003_E001);
  if (!p || p < 2500) continue;
  const name = (names.get(`1600000US${geoid}`) ?? f[G_NAME]).split(",")[0].replace(/ (city|town|village|borough|CDP|municipality|city and borough|urban county|consolidated government \(balance\)|metropolitan government \(balance\)|unified government \(balance\))$/i, "");
  placeName.set(geoid, name);
  const lon = Number(f[G_LON]), lat = Number(f[G_LAT]);
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
  rows.push([geoid, JSON.stringify(name), lon, lat, p].join(","));
}
writeFileSync("/tmp/places.csv", rows.join("\n"));
console.log(`places with 2,500+ people: ${rows.length - 1}`);
const cdShp = join(GEO, "cd119", readdirSync(join(GEO, "cd119")).find((n) => n.endsWith(".shp")));
await mapshaper.runCommands(`-i "${cdShp}" name=cd -proj wgs84 -i /tmp/places.csv name=pl string-fields=geoid -points x=lon y=lat -join cd fields=STATEFP,CD119FP -o /tmp/placed.json format=json`);
for (const p of JSON.parse(readFileSync("/tmp/placed.json", "utf8"))) {
  if (!p.STATEFP || !FIPS[p.STATEFP] || p.CD119FP === "ZZ") continue;
  facts[key(p.STATEFP, cdOf(p.CD119FP))]?.places.push({ name: p.name, population: p.population });
}
// A big city's center falls in only one of the districts it spans (San Francisco, Philadelphia,
// New York City). For a district with no place centered in it, list the places that cover the
// most of its land, from the Census district-to-place relationship file, marked as partial.
const relDir = join(GEO, "rel");
const relName = (() => { try { return readdirSync(relDir).find((n) => /place/i.test(n) && n.endsWith(".txt")); } catch { return null; } })();
if (relName) {
  const [rh, ...rl] = readFileSync(join(relDir, relName), "utf8").replace(/^\uFEFF/, "").trim().split("\n");
  const rs = rh.includes("|") ? "|" : ",";
  const cols = rh.split(rs).map((c) => c.trim().toUpperCase());
  const col = (re) => cols.findIndex((c) => re.test(c));
  const iCd = col(/^GEOID_CD119/), iPl = col(/^GEOID_PLACE/), iPart = col(/^AREALAND_PART$/);
  console.log(`relationship file ${relName}: ${cols.join(",")}`);
  if (iCd >= 0 && iPl >= 0 && iPart >= 0) {
    const byCd = new Map();
    for (const line of rl) {
      const v = line.split(rs);
      const cdId = v[iCd], pl = v[iPl], area = Number(v[iPart]);
      if (!cdId || !pl || !(area > 0)) continue;
      const k = FIPS[cdId.slice(0, 2)] && cdOf(cdId.slice(2, 4)) != null ? key(cdId.slice(0, 2), cdOf(cdId.slice(2, 4))) : null;
      if (k && facts[k] && !facts[k].places.length) byCd.set(k, [...(byCd.get(k) ?? []), { pl, area }]);
    }
    for (const [k, list] of byCd) {
      const total = list.reduce((n, r) => n + r.area, 0);
      facts[k].places = list
        .filter((r) => r.area / total >= 0.05)
        .map((r) => ({ name: placeName.get(r.pl), population: ok(pop.get(`1600000US${r.pl}`)?.B01003_E001), area: r.area }))
        .filter((r) => r.name && r.population >= 2500)
        .sort((a, z) => z.area - a.area).slice(0, 3)
        .map(({ name, population }) => ({ name, population, part: true }));
    }
  }
}
for (const f of Object.values(facts)) {
  f.counties.sort((a, z) => z.population - a.population);
  if (!f.places.some((p) => p.part)) f.places = f.places.sort((a, z) => z.population - a.population).slice(0, 8);
}

writeFileSync("public/maps/cd119/facts.json", JSON.stringify({
  source: `U.S. Census Bureau, American Community Survey ${ACS_YEARS} 5-year estimates, 119th Congress districts; places from the Census Gazetteer`,
  years: ACS_YEARS,
  districts: facts,
}));
console.log("no places:", Object.entries(facts).filter(([, f]) => !f.places.length).map(([k]) => k).join(" ") || "none");
console.log("CA-11:", JSON.stringify(facts["CA-11"]?.places), "NY-12:", JSON.stringify(facts["NY-12"]?.places));
console.log(`facts for ${Object.keys(facts).length} districts; CA-12:`, JSON.stringify(facts["CA-12"]).slice(0, 500));
