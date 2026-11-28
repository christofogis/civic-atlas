import test from "node:test";
import assert from "node:assert/strict";
import { urlset, sitemapIndex, childSitemaps, parseChild, STATIC_PAGES } from "../lib/sitemap.js";

test("child sitemaps: one per 1,000 rows", () => {
  assert.deepEqual(childSitemaps({ bills: { 119: 2001, 118: 1000 }, statePeople: 1 }),
    ["/sitemap/main.xml", "/sitemap/bills-118-1.xml", "/sitemap/bills-119-1.xml", "/sitemap/bills-119-2.xml", "/sitemap/bills-119-3.xml", "/sitemap/state-1.xml"]);
  assert.deepEqual(childSitemaps({}), ["/sitemap/main.xml"]);
});

test("child names round-trip", () => {
  for (const p of childSitemaps({ bills: { 119: 5000 }, statePeople: 3000 })) assert.ok(parseChild(p.replace("/sitemap/", "")), p);
  assert.deepEqual(parseChild("bills-119-3.xml"), { kind: "bills", congress: 119, page: 3 });
  assert.equal(parseChild("../x.xml"), null);
});

test("XML: escaped locations, optional lastmod", () => {
  const x = urlset("https://e.x", [{ path: "/a?b=1&c=2" }, { path: "/bill/119/hr/1", lastmod: "2025-07-04" }]);
  assert.match(x, /<loc>https:\/\/e\.x\/a\?b=1&amp;c=2<\/loc><\/url>/);
  assert.match(x, /<lastmod>2025-07-04<\/lastmod>/);
  assert.match(sitemapIndex("https://e.x", ["/sitemap/main.xml"]), /<sitemapindex[^>]*>\n  <sitemap><loc>https:\/\/e\.x\/sitemap\/main\.xml<\/loc><\/sitemap>/);
  assert.ok(STATIC_PAGES.includes("/on-the-ballot"));
  assert.ok(STATIC_PAGES.includes("/constitution"));
});
