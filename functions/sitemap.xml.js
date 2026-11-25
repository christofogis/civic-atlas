// /sitemap.xml: the site's main pages and every member serving now, for search engines.
// Rebuilt at most once a day per edge (Cache-Control); one small database read.
import { rest } from "../lib/rest.js";

const PAGES = ["/", "/members", "/bills", "/week", "/map", "/government", "/budget", "/measures", "/committees",
  "/topics", "/elections", "/glossary", "/methods", "/corrections", "/quiz", "/local/ca-orange"];

export async function onRequestGet({ request }) {
  const origin = new URL(request.url).origin;
  let members = [];
  try { members = await rest("member_directory?serving=is.true&select=bioguide_id"); } catch { /* pages only */ }
  const urls = [...PAGES, ...members.map((m) => `/member/${m.bioguide_id}`)];
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    urls.map((u) => `  <url><loc>${origin}${u}</loc></url>`).join("\n")}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
