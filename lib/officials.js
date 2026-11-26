// Officials for a set of districts: federal, state and (Orange County pilot) local. Shared by
// /api/lookup (districts from an address or a location) and /api/officials (districts from a
// saved or shared link, no address involved).
import { rest } from "./rest.js";
import { districtKey, STATEWIDE } from "./stateleg.js";
import { containing } from "./geo.js";

// Counties with local officials on the site (pilot: Orange County, CA). The district map is a
// static file built from the county's own GIS layer; the officials are in public/data/local/.
export const LOCAL = { "CA|Orange County": {
  id: "ca-orange", map: "/maps/local/ca-orange-supervisors.json", places: "/maps/local/ca-orange-places.json",
  // The county's layer marks unincorporated communities (Rossmoor, Ladera Ranch) as "City" too,
  // so incorporation comes from this list of Orange County's 34 cities.
  incorporated: new Set(["Aliso Viejo", "Anaheim", "Brea", "Buena Park", "Costa Mesa", "Cypress", "Dana Point", "Fountain Valley",
    "Fullerton", "Garden Grove", "Huntington Beach", "Irvine", "La Habra", "La Palma", "Laguna Beach", "Laguna Hills", "Laguna Niguel",
    "Laguna Woods", "Lake Forest", "Los Alamitos", "Mission Viejo", "Newport Beach", "Orange", "Placentia", "Rancho Santa Margarita",
    "San Clemente", "San Juan Capistrano", "Santa Ana", "Seal Beach", "Stanton", "Tustin", "Villa Park", "Westminster", "Yorba Linda"]),
  // Council district maps, one file per city that elects by district (built from the Registrar's file).
  councilMap: (city) => `/maps/local/ca-orange-council/${city.toLowerCase().replace(/[^a-z]+/g, "-")}.json`,
} };

// California Board of Equalization district(s) for a point: four districts drawn by the Citizens
// Redistricting Commission, which don't follow state Senate lines, so they come from a map
// (public/maps/state/ca-boe.json, built by scripts/data/ca-boe.mjs). Other states: none.
export async function boeFor(state, point, load) {
  if (state !== "CA" || point?.lat == null || point?.lng == null || !load) return [];
  try {
    const d = containing((await load("/maps/state/ca-boe.json")).features ?? [], point.lng, point.lat)?.properties?.district;
    return d ? [d] : [];
  } catch { return []; }
}

// Local districts for a point. `load(path)` reads a static map file from the site.
export async function localFor(geoJson, point, load) {
  const r = geoJson?.results?.[0];
  const ac = r?.address_components ?? {};
  const st = ac.state_province ?? ac.state;
  const county = ac.county;
  const conf = LOCAL[`${st}|${county}`];
  if (!conf) return { covered: false, county: county ?? null };
  const out = { covered: true, id: conf.id, county, supervisor_district: null, place: null, city: null };
  const { lat, lng } = point ?? r.location ?? {};
  if (lat == null || lng == null || !load) return out;
  try {
    const map = await load(conf.map);
    out.supervisor_district = containing(map.features ?? [], lng, lat)?.properties?.district ?? null;
    // Which city (or unincorporated community) the point is in, from the county's boundaries.
    const place = containing((await load(conf.places)).features ?? [], lng, lat)?.properties;
    if (place) {
      const city = conf.incorporated.has(place.name);
      // Unincorporated land outside a named community comes back as "Supervisory District N".
      out.place = { name: city || place.type === "City" ? place.name : null, type: city ? "city" : "unincorporated" };
    }
    if (out.place?.type === "city") {
      out.city = { id: out.place.name.toLowerCase().replace(/[^a-z]+/g, "-"), name: out.place.name, council_district: null };
      try {
        // Cities that elect at large have no file; Pages may answer with the site's HTML, which won't parse.
        const council = await load(conf.councilMap(out.place.name));
        out.city.council_district = containing(council.features ?? [], lng, lat)?.properties?.district ?? null;
      } catch { /* at-large city, or map unavailable */ }
    }
  } catch { /* districts stay unknown; countywide officials still show */ }
  return out;
}


// The same local block rebuilt from a saved link's parameters (validated by the caller).
export function localFromSaved({ co, sd, pl, pt, cc }) {
  const conf = Object.values(LOCAL).find((c) => c.id === co);
  if (!conf) return null;
  const county = Object.entries(LOCAL).find(([, c]) => c === conf)[0].split("|")[1];
  const out = { covered: true, id: conf.id, county, supervisor_district: sd ?? null, place: null, city: null };
  if (pl) {
    const isCity = pt === "c" && conf.incorporated.has(pl);
    out.place = { name: pl, type: isCity ? "city" : "unincorporated" };
    if (isCity) out.city = { id: pl.toLowerCase().replace(/[^a-z]+/g, "-"), name: pl, council_district: cc ?? null };
  } else if (pt === "u") out.place = { name: null, type: "unincorporated" };
  return out;
}

// asOf (YYYY-MM-DD) rehearses a future date, such as a Congress transition; only automated checks pass it.
export async function officialsFor({ state: st, districts, congress, stateDistricts, local, approximate, asOf = null }) {
  const place = { state: st, districts };
  const state = encodeURIComponent(place.state);
  const seats = await rest(
    `${asOf ? `rpc/seat_holders_on?as_of=${asOf}&` : "seat_holders?"}state=eq.${state}&select=bioguide_id,chamber,state,district,state_rank,party,start_date,end_date,seat_status,url`
  );
  const house = seats.filter((s) => s.chamber === "house");
  // A single-seat state is at-large however Geocodio numbers it (0, or 98 for D.C.).
  // When a location spans districts, list them by how much of it each covers.
  const houseSeats = house.length === 1 ? house : house.filter((s) => place.districts.includes(s.district))
    .sort((a, b) => place.districts.indexOf(a.district) - place.districts.indexOf(b.district));
  const senate = seats.filter((s) => s.chamber === "senate")
    .sort((a, b) => (a.state_rank === "senior" ? -1 : 1) - (b.state_rank === "senior" ? -1 : 1));
  const picked = [...senate, ...houseSeats];

  const ids = picked.map((s) => s.bioguide_id).join(",");
  const people = ids
    ? await rest(`members?bioguide_id=in.(${ids})&select=bioguide_id,first_name,last_name,nickname,official_full_name`)
    : [];
  const byId = new Map(people.map((p) => [p.bioguide_id, p]));
// Washington office phone, from each member's latest term.
const phones = new Map();
if (ids) {
  for (const t of await rest(`terms?bioguide_id=in.(${ids})&select=bioguide_id,phone,start_date&order=start_date.desc`).catch(() => [])) {
    if (!phones.has(t.bioguide_id) && t.phone) phones.set(t.bioguide_id, t.phone);
  }
}

  // State officials: statewide offices, then the state senator(s) and representative(s) for the
  // address. Nebraska's one chamber ("legislature") is matched against Geocodio's senate district.
  const inList = (keys) => keys.map((k) => `"${k}"`).join(",");
  const filters = [`type.in.(${STATEWIDE.map((t) => `"${t}"`).join(",")})`];
  if (stateDistricts.upper.length) filters.push(`and(type.in.(upper,legislature),district_key.in.(${inList(stateDistricts.upper)}))`);
  if (stateDistricts.lower.length) filters.push(`and(type.eq.lower,district_key.in.(${inList(stateDistricts.lower)}))`);
  let stateOfficials = [];
  try {
    stateOfficials = await rest(`state_officeholders?state=eq.${state}&or=(${filters.join(",")})&select=id,name,party,type,district,start_date`);
  } catch { /* state officials are optional; federal results still show */ }
  // A statewide office whose holder's term ended recently, with no successor in Open States yet:
  // show the seat as updating rather than leaving it out (or showing the previous holder).
  try {
    const today = asOf ?? new Date().toISOString().slice(0, 10);
    const since = new Date(Date.parse(today) - 120 * 864e5).toISOString().slice(0, 10);
    const ended = await rest(`state_roles?state=eq.${state}&type=in.(${STATEWIDE.map((t) => `"${t}"`).join(",")})&end_date=gte.${since}&end_date=lt.${today}&select=type,end_date`);
    const held = new Set(stateOfficials.map((o) => o.type));
    for (const r of ended) {
      if (held.has(r.type)) continue;
      held.add(r.type);
      stateOfficials.push({ id: null, type: r.type, updating: true, term_ended: r.end_date, name: "", party: null });
    }
  } catch { /* optional */ }
  // The address's own legislators first, then statewide offices.
  const order = (o) => (o.type === "upper" || o.type === "legislature" ? 0 : o.type === "lower" ? 1 : 10 + STATEWIDE.indexOf(o.type));
  const distOrder = (o) => {
    const list = o.type === "lower" ? stateDistricts.lower : stateDistricts.upper;
    return list.indexOf(districtKey(o.district));
  };
  if (stateOfficials.some((o) => o.id)) {
  const people = await rest(`state_people?id=in.(${stateOfficials.filter((o) => o.id).map((o) => `"${o.id}"`).join(",")})&select=id,offices,image_url`).catch(() => []);
  const voice = new Map(people.map((p) => [p.id, (p.offices ?? []).find((o) => o.classification === "capitol" && o.voice)?.voice ?? (p.offices ?? []).find((o) => o.voice)?.voice ?? null]));
  const image = new Map(people.map((p) => [p.id, p.image_url ?? null]));
  for (const o of stateOfficials) { o.phone = voice.get(o.id) ?? null; o.image = image.get(o.id) ?? null; }
}
stateOfficials.sort((a, b) => order(a) - order(b) || distOrder(a) - distOrder(b) || a.name.localeCompare(b.name));

  return {
    state: place.state,
    districts: place.districts,
    congress,
    approximate,
    officials: picked.map((s) => {
      const p = byId.get(s.bioguide_id) ?? {};
      return {
        ...s,
        name: p.official_full_name ?? [p.nickname ?? p.first_name, p.last_name].filter(Boolean).join(" "),
      phone: phones.get(s.bioguide_id) ?? null,
      };
    }),
    state_districts: stateDistricts,
    local,
    state_officials: stateOfficials,
    sources: {
      district: "Geocodio (U.S. Census Bureau district boundaries)",
      officials: "unitedstates/congress-legislators",
      state_officials: "Open States (openstates/people)",
    },
  };
}
