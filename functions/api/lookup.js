// GET /api/lookup?address=...  ->  the senators and House member(s) for that address.
//
// Privacy: the address is sent to Geocodio to find the district and is never stored,
// logged, or cached here. Only the district and the officials are returned.
import { districtsFromGeocodio } from "../../lib/geocodio.js";
import { verifyTurnstile } from "../../lib/turnstile.js";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../src/lib/config.js";

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
  });
  if (!res.ok) throw new Error(`database ${res.status}`);
  return res.json();
}

export async function onRequestGet({ request, env }) {
  const address = new URL(request.url).searchParams.get("address")?.trim() ?? "";
  if (address.length < 5 || address.length > 200) {
    return json({ error: "Enter a street address, city and state, or a ZIP code." }, 400);
  }
  if (!env.GEOCODIO_API_KEY) return json({ error: "Address lookup is not configured." }, 500);
  // Bot check before spending a Geocodio lookup. Enforced once TURNSTILE_SECRET_KEY is set.
  const token = request.headers.get("CF-Turnstile-Token");
  if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, request.headers.get("CF-Connecting-IP")))) {
    return json({ error: "Please complete the verification and try again." }, 403);
  }

  const geo = await fetch(
    `https://api.geocod.io/v2.1/geocode?q=${encodeURIComponent(address)}&fields=cd&limit=1&api_key=${env.GEOCODIO_API_KEY}`
  );
  if (geo.status === 422) return json({ error: "That address couldn't be found." }, 404);
  if (!geo.ok) return json({ error: "The address service is unavailable. Try again shortly." }, 502);

  const place = districtsFromGeocodio(await geo.json());
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
      sources: {
        district: "Geocodio (U.S. Census Bureau district boundaries)",
        officials: "unitedstates/congress-legislators",
      },
    });
  } catch {
    return json({ error: "Couldn't load officials right now. Try again shortly." }, 502);
  }
}
