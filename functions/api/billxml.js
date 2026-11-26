// GET /api/billxml?u=https://www.govinfo.gov/content/pkg/BILLS-119hr1eh/xml/BILLS-119hr1eh.xml
// Passes a bill version's official XML through from GovInfo, so the browser can read it (GovInfo
// doesn't allow cross-site reads). Only GovInfo bill and public-law XML paths; nothing else.
// A published version never changes, so responses are cached at the edge for 30 days, and GovInfo
// is asked at most once per version per edge location.
import { cached } from "../../lib/rest.js";

const ALLOWED = /^https:\/\/www\.govinfo\.gov\/content\/pkg\/(BILLS-\d{2,3}[a-z]+\d+[a-z]+|PLAW-\d{2,3}(publ|pvtl)\d+)\/(xml|uslm)\/[A-Za-z0-9-]+\.xml$/;

export async function onRequestGet(context) {
  const u = new URL(context.request.url).searchParams.get("u") ?? "";
  if (!ALLOWED.test(u)) return new Response("Not a GovInfo bill text address.", { status: 400 });
  return cached(context, async () => {
    const res = await fetch(u, { headers: { "User-Agent": "civic-atlas (github.com/christofogis/civic-atlas)" }, cf: { cacheTtl: 2592000, cacheEverything: true } });
    if (!res.ok) return new Response(`GovInfo answered ${res.status}.`, { status: 502 });
    return new Response(res.body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=2592000, immutable" } });
  });
}
