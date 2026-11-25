// GET /api/lookup?address=...      the officials for an address
// GET /api/lookup?lat=..&lng=..     the officials for a location (the browser's, with permission)
//
// Privacy: the address or location is sent to Geocodio to find the districts and is never
// stored, logged, or cached here. Only the districts and the officials are returned.
import { congressOn } from "../../lib/congress.js";
import { districtsFromGeocodio } from "../../lib/geocodio.js";
import { isCheckRequest, verifyTurnstile } from "../../lib/turnstile.js";
import { stateDistrictsFromGeocodio } from "../../lib/stateleg.js";
import { boeFor, localFor, officialsFor } from "../../lib/officials.js";

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const params = new URL(request.url).searchParams;
  const address = params.get("address")?.trim() ?? "";
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  const byPoint = params.has("lat") && params.has("lng");
  if (byPoint) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return json({ error: "That location couldn't be used." }, 400);
    }
  } else if (address.length < 5 || address.length > 200) {
    return json({ error: "Enter a street address, city and state, or a ZIP code." }, 400);
  }
  if (!env.GEOCODIO_API_KEY) return json({ error: "Address lookup is not configured." }, 500);
  // Bot check before spending a Geocodio lookup. Enforced once TURNSTILE_SECRET_KEY is set.
  const token = request.headers.get("CF-Turnstile-Token");
  const automatedCheck = isCheckRequest(request.headers.get("X-Check-Token"), env.LOOKUP_CHECK_TOKEN);
  if (!automatedCheck && !(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP")))) {
    return json({ error: "Please complete the verification and try again." }, 403);
  }

  // Automated checks may rehearse a future date (?as_of=2027-01-03): districts and seat holders as
  // they would be that day. Ignored for everyone else.
  const asOfParam = params.get("as_of");
  const asOf = automatedCheck && /^\d{4}-\d{2}-\d{2}$/.test(asOfParam ?? "") ? asOfParam : null;

  // Ask for the districts of the Congress in session by date (cd119, then cd120 from Jan 3,
  // 2027) rather than Geocodio's default, so the map can't switch ahead of or behind our data.
  const fields = `fields=cd${congressOn(asOf ?? new Date())},stateleg&limit=1&api_key=${env.GEOCODIO_API_KEY}`;
  // Five decimal places is about a meter: plenty for districts, and no more precise than needed.
  const geo = await fetch(byPoint
    ? `https://api.geocod.io/v2.1/reverse?q=${lat.toFixed(5)},${lng.toFixed(5)}&${fields}`
    : `https://api.geocod.io/v2.1/geocode?q=${encodeURIComponent(address)}&${fields}`);
  if (geo.status === 422) return json({ error: byPoint ? "That location couldn't be used." : "That address couldn't be found." }, 404);
  if (!geo.ok) return json({ error: "The address service is unavailable. Try again shortly." }, 502);

  const geoJson = await geo.json();
  const place = districtsFromGeocodio(geoJson);
  if (!place?.state) return json({ error: byPoint ? "That location couldn't be used." : "That address couldn't be found." }, 404);
  const load = env.ASSETS ? async (path) => (await env.ASSETS.fetch(new URL(path, request.url))).json() : null;
  const local = await localFor(geoJson, byPoint ? { lat, lng } : null, load);
  const stateDistricts = stateDistrictsFromGeocodio(geoJson);
  stateDistricts.boe = await boeFor(place.state, byPoint ? { lat, lng } : geoJson.results?.[0]?.location, load);

  try {
    return json(await officialsFor({
      state: place.state, districts: place.districts, congress: place.congress,
      stateDistricts, local,
      asOf,
      approximate: place.districts.length > 1 || !["rooftop", "range_interpolation", "point"].includes(place.accuracy_type),
    }));
  } catch {
    return json({ error: "Couldn't load officials right now. Try again shortly." }, 502);
  }
}
