// Serve index.html with a record's title, description, canonical URL and link-preview tags, for the
// route Functions in functions/member, functions/bill, functions/committee, functions/state and
// functions/on-the-ballot.js and functions/constitution.js. Any failure or slow database read serves the plain shell unchanged,
// so the page itself never depends on this.
//
// Free-plan limits (10 ms CPU, 100k requests/day): only these routes run a Function (Pages builds
// _routes.json from the functions folder, so scripts, styles and images never do). The work per
// request is one small database row, cached at the edge for an hour, and HTMLRewriter, which
// streams the ~2 KB shell without parsing it into memory. Waiting on the network is not CPU time.
// The HTML itself is never cached: after a deploy it must name the new build's script files.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../src/lib/config.js";
import { rewriteHandlers } from "./pageMeta.js";

const TIMEOUT_MS = 1500;
const FOUND_TTL = 3600;     // data changes with the twice-daily ingest runs
const MISSING_TTL = 300;    // a record that isn't there yet may arrive with the next run

export const todayLA = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
export const langOf = (url) => (url.searchParams.get("lang") === "es" ? "es" : "en");

// One database read (PostgREST path), through the edge cache. Returns the first row, or null when
// the database answered and there is no such record. Throws on errors and timeouts.
export async function cachedRow(context, path) {
  const origin = new URL(context.request.url).origin;
  const key = new Request(`${origin}/__meta-cache/${encodeURIComponent(path)}`);
  const cache = globalThis.caches?.default;
  const hit = cache && await cache.match(key);
  if (hit) return (await hit.json()).row;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`database ${res.status}`);
  const row = (await res.json())[0] ?? null;
  if (cache) {
    const stored = new Response(JSON.stringify({ row }), { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${row ? FOUND_TTL : MISSING_TTL}` } });
    context.waitUntil(cache.put(key, stored));
  }
  return row;
}

// build(url, lang, today) -> meta object, null when the record doesn't exist, or throws.
export async function serveWithMeta(context, build) {
  const { request, env } = context;
  if (request.method !== "GET") return context.next();
  const url = new URL(request.url);
  // A fresh request for the shell, without the visitor's conditional headers: a 304 has no body to rewrite.
  const shell = await env.ASSETS.fetch(new Request(new URL("/", url)));
  if (!shell.ok || !(shell.headers.get("Content-Type") ?? "").includes("text/html")) return shell;

  let meta;
  try {
    meta = await Promise.race([
      build(url, langOf(url), todayLA()),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS + 200)),
    ]);
  } catch {
    return shell;   // database down or slow: the page still works, with the generic tags
  }

  const headers = new Headers(shell.headers);
  headers.delete("ETag");             // the body differs from index.html's
  headers.delete("Content-Length");
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  if (meta === null) {
    // No such record: the page shows "not found", and search engines get a real 404.
    headers.set("X-Robots-Tag", "noindex");
    return new Response(shell.body, { status: 404, headers });
  }
  let rewriter = new HTMLRewriter();
  for (const [selector, handler] of rewriteHandlers(meta)) rewriter = rewriter.on(selector, handler);
  return rewriter.transform(new Response(shell.body, { status: 200, headers }));
}
