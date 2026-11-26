// /sitemap/main.xml, /sitemap/bills-<congress>-<page>.xml, /sitemap/state-<page>.xml: the child
// sitemaps listed by /sitemap.xml. One database page each; cached a day per edge.
import { rest, cached } from "../../lib/rest.js";
import { urlset, parseChild, STATIC_PAGES, PAGE_SIZE, XML_HEADERS } from "../../lib/sitemap.js";

const notFound = () => new Response("Not found", { status: 404 });

export async function onRequestGet(context) {
  const child = parseChild(String(context.params.name ?? ""));
  if (!child || child.page === 0) return notFound();
  return cached(context, async () => {
    const origin = new URL(context.request.url).origin;
    const range = child.page ? `&order=${child.kind === "bills" ? "bill_type,number" : "id"}&limit=${PAGE_SIZE}&offset=${(child.page - 1) * PAGE_SIZE}` : "";
    let entries;
    try {
      if (child.kind === "main") {
        const [members, committees] = await Promise.all([
          rest("member_directory?select=bioguide_id&order=bioguide_id"),
          rest("committees?select=committee_id&order=committee_id"),
        ]);
        entries = [...STATIC_PAGES.map((path) => ({ path })),
          ...members.map((m) => ({ path: `/member/${m.bioguide_id}` })),
          ...committees.map((c) => ({ path: `/committee/${c.committee_id}` }))];
      } else if (child.kind === "bills") {
        const bills = await rest(`bills?congress=eq.${child.congress}&select=bill_type,number,latest_action_date${range}`);
        entries = bills.map((b) => ({ path: `/bill/${child.congress}/${b.bill_type}/${b.number}`, lastmod: b.latest_action_date }));
      } else {
        const people = await rest(`state_people?active=is.true&select=id${range}`);
        entries = people.map((p) => ({ path: `/state/person/${p.id.replace(/^ocd-person\//, "")}` }));
      }
    } catch {
      return new Response("Couldn't load the sitemap right now.", { status: 503, headers: { "Retry-After": "3600" } });
    }
    if (!entries.length) return notFound();
    return new Response(urlset(origin, entries), { headers: XML_HEADERS });
  });
}
