// GET /api/officials?st=CA&cd=45&su=36&sl=70&co=ca-orange&sd=1&pl=Los%20Alamitos&pt=c&cc=1
// The officials for a saved or shared set of districts. No address, no location, no Geocodio
// call (so no bot check): the link holds only district numbers and names.
import { LOCAL, localFromSaved, officialsFor } from "../../lib/officials.js";
import { congressOn } from "../../lib/congress.js";

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "public, max-age=300" } });
const list = (v, re) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter((s) => re.test(s)).slice(0, 4);

export async function onRequestGet({ request }) {
  const p = new URL(request.url).searchParams;
  const st = (p.get("st") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(st)) return json({ error: "This link is missing its state." }, 400);
  // House districts belong to one Congress's lines. A link from an earlier Congress (or from
  // before links carried cg, which were all 119th) keeps its state and local districts but
  // drops the House district, and says so.
  const current = congressOn();
  const linkCongress = /^\d{3}$/.test(p.get("cg") ?? "") ? Number(p.get("cg")) : 119;
  const stale = linkCongress !== current;
  const districts = stale ? [] : list(p.get("cd"), /^\d{1,2}$/).map(Number);
  const stateDistricts = { upper: list(p.get("su"), /^[a-z0-9]{1,40}$/), lower: list(p.get("sl"), /^[a-z0-9]{1,40}$/) };
  const int = (k) => (/^\d{1,2}$/.test(p.get(k) ?? "") ? Number(p.get(k)) : null);
  const co = p.get("co");
  const pl = (p.get("pl") ?? "").slice(0, 60);
  const local = co && Object.values(LOCAL).some((c) => c.id === co)
    ? localFromSaved({ co, sd: int("sd"), pl: /^[A-Za-z .'-]+$/.test(pl) ? pl : null, pt: p.get("pt"), cc: int("cc") })
    : { covered: false, county: null };
  try {
    const body = await officialsFor({ state: st, districts, congress: current, stateDistricts, local, approximate: false });
    if (stale) body.stale_districts = linkCongress;
    body.sources.district = "Saved districts (this link holds no address)";
    return json(body);
  } catch {
    return json({ error: "Couldn't load officials right now. Try again shortly." }, 502);
  }
}
