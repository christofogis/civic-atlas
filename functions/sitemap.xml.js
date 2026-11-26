// /sitemap.xml: an index of the child sitemaps in functions/sitemap/[name].js (site pages, members
// and committees; bills by Congress; state officials), sized from row counts. Cached a day per edge.
import { count, cached } from "../lib/rest.js";
import { congressOn } from "../lib/congress.js";
import { sitemapIndex, childSitemaps, FIRST_CONGRESS, XML_HEADERS } from "../lib/sitemap.js";

export async function onRequestGet(context) {
  return cached(context, async () => {
    const origin = new URL(context.request.url).origin;
    const congresses = [];
    for (let c = FIRST_CONGRESS; c <= congressOn(); c++) congresses.push(c);
    let counts = { bills: {}, statePeople: 0 };
    try {
      const [statePeople, ...bills] = await Promise.all([
        count("state_people?active=is.true&select=id"),
        ...congresses.map((c) => count(`bills?congress=eq.${c}&select=number`)),
      ]);
      counts = { statePeople, bills: Object.fromEntries(congresses.map((c, i) => [c, bills[i]])) };
    } catch { /* database unreachable: list the main sitemap only */ }
    return new Response(sitemapIndex(origin, childSitemaps(counts)), { headers: XML_HEADERS });
  });
}
