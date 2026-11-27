// Sitemap XML for search engines. /sitemap.xml is an index of smaller sitemaps, because bills and
// state officials run to tens of thousands of pages: each child sitemap is at most one database page
// (PAGE_SIZE rows, the API's row cap), which keeps every request small and within the CPU limit.
export const PAGE_SIZE = 1000;
export const FIRST_CONGRESS = 118;   // coverage starts with the 118th Congress (2023)

export const STATIC_PAGES = ["/", "/members", "/bills", "/week", "/map", "/government", "/budget", "/measures", "/committees",
  "/topics", "/issues", "/elections", "/on-the-ballot", "/officials", "/glossary", "/methods", "/status", "/corrections", "/quiz", "/first-time-voter", "/local/ca-orange"];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const xml = (body) => `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`;

// entries: [{ path, lastmod? }]
export function urlset(origin, entries) {
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((e) =>
    `  <url><loc>${esc(origin + e.path)}</loc>${e.lastmod ? `<lastmod>${esc(String(e.lastmod).slice(0, 10))}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>`);
}

export function sitemapIndex(origin, paths) {
  return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) =>
    `  <sitemap><loc>${esc(origin + p)}</loc></sitemap>`).join("\n")}\n</sitemapindex>`);
}

// Child sitemap paths, from row counts: { bills: { 118: 19000, 119: 12000 }, statePeople: 7400 }.
export function childSitemaps({ bills = {}, statePeople = 0 }) {
  const pages = (n) => Array.from({ length: Math.ceil(n / PAGE_SIZE) }, (_, i) => i + 1);
  return [
    "/sitemap/main.xml",
    ...Object.keys(bills).sort().flatMap((c) => pages(bills[c]).map((p) => `/sitemap/bills-${c}-${p}.xml`)),
    ...pages(statePeople).map((p) => `/sitemap/state-${p}.xml`),
  ];
}

// "/sitemap/bills-119-3.xml" -> { kind: "bills", congress: 119, page: 3 }
export function parseChild(name) {
  let m;
  if (name === "main.xml") return { kind: "main" };
  if ((m = name.match(/^bills-(\d{3})-(\d{1,3})\.xml$/))) return { kind: "bills", congress: Number(m[1]), page: Number(m[2]) };
  if ((m = name.match(/^state-(\d{1,3})\.xml$/))) return { kind: "state", page: Number(m[1]) };
  return null;
}

export const XML_HEADERS = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400" };
