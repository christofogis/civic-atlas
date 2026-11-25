// GET /api/calendar/week?st=CA&cd=45&...&lang=en  ->  iCalendar: "Your week" for a set of districts,
// for calendar apps to subscribe to (they re-read it every few hours). The link holds only district
// numbers and names, never an address. Each event links back to its page on the site.
import { officialsFor } from "../../../lib/officials.js";
import { savedDistrictsFrom } from "../../../lib/savedLink.js";
import { weekItems, weekIcs } from "../../../lib/yourWeek.js";
import { rest, cached } from "../../../lib/rest.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const d = savedDistrictsFrom(url.searchParams);
  if (!d) return new Response("This link is missing its state.", { status: 400 });
  const es = url.searchParams.get("lang") === "es";
  const tr = (en, sp) => (es && sp != null ? sp : en);
  return cached(context, async () => {
    const result = await officialsFor({ state: d.state, districts: d.districts, congress: d.congress, stateDistricts: d.stateDistricts, local: d.local, approximate: false });
    const json = async (path) => {
      const res = await context.env.ASSETS.fetch(new URL(path, url.origin));
      if (!res.ok) throw new Error(`${path}: ${res.status}`);
      return res.json();
    };
    const items = await weekItems({ result, params: url.searchParams, days: 90, deps: { rest, json, tr } });
    const place = [url.searchParams.get("pl"), d.state].filter(Boolean).join(", ");
    const body = weekIcs({ items, origin: url.origin, name: tr(`Your officials' calendar: ${place} (Civic Atlas)`, `Calendario de sus funcionarios: ${place} (Civic Atlas)`) });
    return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=1800" } });
  });
}
