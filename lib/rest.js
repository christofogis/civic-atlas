// Read-only database queries for Cloudflare Pages Functions, with the public publishable key.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../src/lib/config.js";

export async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
  if (!res.ok) throw new Error(`database ${res.status}`);
  return res.json();
}

// Responses that feed readers and calendar apps poll: cache for 30 minutes at Cloudflare's edge.
export async function cached(context, build) {
  const cache = caches.default;
  const key = new Request(new URL(context.request.url).toString(), { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await build();
  if (res.ok) context.waitUntil(cache.put(key, res.clone()));
  return res;
}

// How many rows a query matches, without fetching them (PostgREST exact count in Content-Range).
export async function count(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}${path.includes("?") ? "&" : "?"}limit=1`, {
    method: "HEAD", headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Prefer: "count=exact" },
  });
  const total = Number((res.headers.get("Content-Range") ?? "").split("/")[1]);
  if (!res.ok || !Number.isFinite(total)) throw new Error(`database ${res.status}`);
  return total;
}
