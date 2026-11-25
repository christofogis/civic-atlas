// GET /api/lookup?address=...  ->  the senators and House member(s) for that address.
//
// Privacy: the address is sent to Geocodio to find the district and is never stored,
// logged, or cached here. Only the district and the officials are returned.
import { congressOn } from "../../lib/congress.js";
import { districtsFromGeocodio } from "../../lib/geocodio.js";
import { isCheckRequest, verifyTurnstile } from "../../lib/turnstile.js";
import { rest } from "../../lib/rest.js";
import { districtKey, stateDistrictsFromGeocodio, STATEWIDE } from "../../lib/stateleg.js";
import { containing } from "../../lib/geo.js";

// Counties with local officials on the site (pilot: Orange County, CA). The district map is a
// static file built from the county's own GIS layer; the officials are in public/data/local/.
const LOCAL = { "CA|Orange County": { id: "ca-orange", map: "/maps/local/ca-orange-supervisors.json" } };

async function localFor(geoJson, request, env) {
  const r = geoJson?.results?.[0];
  const ac = r?.address_components ?? {};
  const st = ac.state_province ?? ac.state;
  const county = ac.county;
  const conf = LOCAL[`${st}|${county}`];
  if (!conf) return { covered: false, county: county ?? null };
  const out = { covered: true, id: conf.id, county, supervisor_district: null };
  const { lat, lng } = r.location ?? {};
  if (lat == null || lng == null || !env.ASSETS) return out;
  try {
    const map = await (await env.ASSETS.fetch(new URL(conf.map, request.url))).json();
    out.supervisor_district = containing(map.features ?? [], lng, lat)?.properties?.district ?? null;
  } catch { /* district stays unknown; countywide officials still show */ }
  return out;
}

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });


export async function onRequestGet({ request, env }) {
  const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";
  if (address.length < 5 || address.length > 200) {
    return json({ error: "Enter a street address, city and state, or a ZIP code." }, 400);
  }
  if (!env.GEOCODIO_API_KEY) return json({ error: "Address lookup is not configured." }, 500);
  // Bot check before spending a Geocodio lookup. Enforced once TURNSTILE_SECRET_KEY is set.
  const token = request.headers.get("CF-Turnstile-Token");
  const automatedCheck = isCheckRequest(request.headers.get("X-Check-Token"), env.LOOKUP_CHECK_TOKEN);
  if (!automatedCheck && !(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP")))) {
    return json({ error: "Please complete the verification and try again." }, 403);
  }

  const geo = await fetch(
    // Ask for the districts of the Congress in session by date (cd119, then cd120 from Jan 3,
    // 2027) rather than Geocodio's default, so the map can't switch ahead of or behind our data.
    `https://api.geocod.io/v2.1/geocode?q=${encodeURIComponent(address)}&fields=cd${congressOn()},stateleg&limit=1&api_key=${env.GEOCODIO_API_KEY}`
  );
  if (geo.status === 422) return json({ error: "That address couldn't be found." }, 404);
  if (!geo.ok) return json({ error: "The address service is unavailable. Try again shortly." }, 502);

  const geoJson = await geo.json();
  const place = districtsFromGeocodio(geoJson);
  const stateDistricts = stateDistrictsFromGeocodio(geoJson);
  const local = await localFor(geoJson, request, env);
  if (!place?.state) return json({ error: "That address couldn't be found." }, 404);

  try {
    const state = encodeURIComponent(place.state);
    const seats = await rest(
      `seat_holders?state=eq.${state}&select=bioguide_id,chamber,state,district,state_rank,party,start_date,end_date,seat_status,url`
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
    const order = (o) => (o.type === "upper" || o.type === "legislature" ? 100 : o.type === "lower" ? 200 : STATEWIDE.indexOf(o.type));
    const distOrder = (o) => {
      const list = o.type === "lower" ? stateDistricts.lower : stateDistricts.upper;
      return list.indexOf(districtKey(o.district));
    };
    stateOfficials.sort((a, b) => order(a) - order(b) || distOrder(a) - distOrder(b) || a.name.localeCompare(b.name));

    return json({
      state: place.state,
      districts: place.districts,
      congress: place.congress,
      approximate: place.districts.length > 1 || !["rooftop", "range_interpolation", "point"].includes(place.accuracy_type),
      officials: picked.map((s) => {
        const p = byId.get(s.bioguide_id) ?? {};
        return {
          ...s,
          name: p.official_full_name ?? [p.nickname ?? p.first_name, p.last_name].filter(Boolean).join(" "),
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
    });
  } catch {
    return json({ error: "Couldn't load officials right now. Try again shortly." }, 502);
  }
}
