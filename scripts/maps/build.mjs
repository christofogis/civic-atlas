// Builds the map files in public/maps/ from Census boundary files (public domain):
//   states.json            state outlines (cartographic boundary file, 1:500k)
//   cd119/us.json          119th Congress districts, whole country (simplified)
//   cd119/{ST}.json        one state's districts in more detail, for zooming in
//   cd120/...              the same for the 120th Congress (TIGER/Line 2026, clipped to land)
//   meta.json              sources, build date, and which states' lines changed for the 120th
// Run by .github/workflows/build-maps.yml, which downloads the inputs to $GEO_DIR first.
//   GEO_DIR=/tmp/geo node scripts/maps/build.mjs
import { readdirSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import mapshaper from "mapshaper";

const GEO = process.env.GEO_DIR ?? "/tmp/geo";
const OUT = "public/maps";
const FIPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY", "60": "AS", "66": "GU", "69": "MP", "72": "PR", "78": "VI",
};
// Simplification by distance: the same for both Congresses, so lines from either source look alike.
const NATIONAL_M = 900;   // whole-country view
const STATE_M = 60;       // zoomed into one state, down to neighborhoods

const run = (cmd) => mapshaper.runCommands(cmd);
const shp = (dir, re) => { const f = readdirSync(join(GEO, dir)).find((n) => re.test(n)); if (!f) throw new Error(`no ${re} in ${dir}`); return join(GEO, dir, f); };
const fipsJson = JSON.stringify(FIPS);
// Normalize district fields: st = "CA", cd = 12 (0 for at-large and delegate seats). "ZZ" (water or unassigned) is dropped.
const normalize = (field) =>
  `-each 'var F=${fipsJson}; st=F[STATEFP]; cd=(${field}=="ZZ")?null:((${field}=="00"||${field}=="98")?0:+${field})' -filter 'st && cd !== null' -filter-fields st,cd`;

async function districts(n, inputs, clip) {
  const dir = join(OUT, `cd${n}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const field = `CD${n}FP`;
  const src = `-i ${inputs.map((f) => `"${f}"`).join(" ")} combine-files -merge-layers force -proj wgs84 ${normalize(field)}${clip ? ` -clip "${clip}" remove-slivers` : ""} -dissolve2 st,cd copy-fields=st,cd`;
  await run(`${src} -simplify interval=${NATIONAL_M} keep-shapes -clean -o "${join(dir, "us.json")}" format=topojson quantization=100000`);
  await run(`${src} -simplify interval=${STATE_M} keep-shapes -clean -split st -o "${dir}/" format=topojson singles quantization=100000`);
  // -split writes one file per state named after the layer (the st value).
  for (const f of readdirSync(dir)) if (!/^([A-Z]{2}|us)\.json$/.test(f)) rmSync(join(dir, f));
}

// Per-state signature: each district's area (km²), to tell which states' lines changed.
async function areas(inputs, field, clip) {
  const tmp = "/tmp/areas.json";
  await run(`-i ${inputs.map((f) => `"${f}"`).join(" ")} combine-files -merge-layers force -proj wgs84 ${normalize(field)}${clip ? ` -clip "${clip}" remove-slivers` : ""} -dissolve2 st,cd copy-fields=st,cd -each 'km2=Math.round(this.area/1e6)' -o "${tmp}" format=json`);
  const rows = JSON.parse(readFileSync(tmp, "utf8"));
  const by = {};
  for (const r of rows) (by[r.st] ??= {})[r.cd] = r.km2;
  return by;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const states500k = shp("states", /\.shp$/);
  await run(`-i "${states500k}" -proj wgs84 -each 'st=STUSPS, name=NAME' -filter-fields st,name -simplify interval=${NATIONAL_M} keep-shapes -clean -o "${join(OUT, "states.json")}" format=topojson quantization=100000`);

  const cd119 = [shp("cd119", /\.shp$/)];
  const cd120 = readdirSync(join(GEO, "cd120")).filter((f) => f.endsWith(".shp")).map((f) => join(GEO, "cd120", f));
  if (cd120.length < 50) throw new Error(`only ${cd120.length} state files for the 120th Congress`);
  await districts(119, cd119, null);              // cartographic boundary file: already clipped to land
  await districts(120, cd120, states500k);        // TIGER/Line: extends into water, so clip to the land outline

  // Which states have different lines for the 120th: same districts, and every area within 3%.
  const a = await areas(cd119, "CD119FP", null);
  const b = await areas(cd120, "CD120FP", states500k);
  const changed = [], report = [];
  for (const st of Object.keys({ ...a, ...b }).sort()) {
    const x = a[st] ?? {}, y = b[st] ?? {};
    const keys = [...new Set([...Object.keys(x), ...Object.keys(y)])];
    const worst = Math.max(...keys.map((k) => (x[k] && y[k] ? Math.abs(x[k] - y[k]) / Math.max(x[k], 1) : 1)));
    report.push(`${st} ${Object.keys(x).length}->${Object.keys(y).length} max area change ${(worst * 100).toFixed(1)}%`);
    if (worst > 0.03 || Object.keys(x).length !== Object.keys(y).length) changed.push(st);
  }
  console.log(report.join("\n"));
  console.log(`changed for the 120th: ${changed.join(", ")}`);
  writeFileSync(join(OUT, "meta.json"), JSON.stringify({
    built: new Date().toISOString().slice(0, 10),
    sources: {
      states: "U.S. Census Bureau, cartographic boundary file cb_2025_us_state_500k",
      cd119: "U.S. Census Bureau, cartographic boundary file cb_2025_us_cd119_500k",
      cd120: "U.S. Census Bureau, TIGER/Line 2026 tl_2026_{state}_cd120, clipped to the state land outline",
    },
    changed120: changed,
  }, null, 1));
  for (const f of ["states.json", "cd119/us.json", "cd120/us.json", "cd120/CA.json"]) {
    const p = join(OUT, f);
    if (existsSync(p)) console.log(f, Math.round(readFileSync(p).length / 1024), "KB");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
