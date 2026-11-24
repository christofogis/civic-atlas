// GET /api/calendar/committee/:id  ->  iCalendar: upcoming hearings and markups of a committee
// and its subcommittees.
import { ics } from "../../../../lib/feeds.js";
import { rest, cached } from "../../../../lib/rest.js";

export async function onRequestGet(context) {
  const id = String(context.params.id ?? "").replace(/\.ics$/, "").toUpperCase();
  if (!/^[A-Z]{4}(\d{2})?$/.test(id)) return new Response("Not found", { status: 404 });
  return cached(context, async () => {
    const origin = new URL(context.request.url).origin;
    const [c] = await rest(`committees?committee_id=eq.${id}&select=name,chamber`);
    if (!c) return new Response("Not found", { status: 404 });
    const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const events = await rest(`upcoming_events?committee_id=like.${id}*&event_date=gte.${since}&select=*&order=event_date`);
    const title = c.chamber === "joint" ? c.name : `${c.chamber === "house" ? "House" : "Senate"} ${c.name}`;
    return new Response(ics({ name: `${title} (Civic Atlas)`, events, origin }), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=1800" },
    });
  });
}
