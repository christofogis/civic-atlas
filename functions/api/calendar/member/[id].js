// GET /api/calendar/member/:bioguide  ->  iCalendar: upcoming hearings and markups of the
// committees and subcommittees the member sits on.
import { ics } from "../../../../lib/feeds.js";
import { rest, cached } from "../../../../lib/rest.js";

export async function onRequestGet(context) {
  const id = String(context.params.id ?? "").replace(/\.ics$/, "");
  if (!/^[A-Z]\d{6}$/.test(id)) return new Response("Not found", { status: 404 });
  return cached(context, async () => {
    const origin = new URL(context.request.url).origin;
    const [m] = await rest(`members?bioguide_id=eq.${id}&select=official_full_name,first_name,last_name`);
    if (!m) return new Response("Not found", { status: 404 });
    const name = m.official_full_name ?? `${m.first_name} ${m.last_name}`;
    const memberships = await rest(`committee_memberships?bioguide_id=eq.${id}&select=committee_id,congress`);
    const latest = Math.max(0, ...memberships.map((r) => r.congress));
    const ids = [...new Set(memberships.filter((r) => r.congress === latest).map((r) => r.committee_id))];
    const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const events = ids.length
      ? await rest(`upcoming_events?committee_id=in.(${ids.join(",")})&event_date=gte.${since}&select=*&order=event_date`)
      : [];
    return new Response(ics({ name: `${name}'s committees (Civic Atlas)`, events, origin }), {
      headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "public, max-age=1800" },
    });
  });
}
