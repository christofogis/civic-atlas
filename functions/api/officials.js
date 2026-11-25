// GET /api/officials?st=CA&cd=45&su=36&sl=70&bo=4&co=ca-orange&sd=1&pl=Los%20Alamitos&pt=c&cc=1
// The officials for a saved or shared set of districts. No address, no location, no Geocodio
// call (so no bot check): the link holds only district numbers and names.
import { officialsFor } from "../../lib/officials.js";
import { savedDistrictsFrom } from "../../lib/savedLink.js";

const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "public, max-age=300" } });

export async function onRequestGet({ request }) {
  const d = savedDistrictsFrom(new URL(request.url).searchParams);
  if (!d) return json({ error: "This link is missing its state." }, 400);
  try {
    const body = await officialsFor({ state: d.state, districts: d.districts, congress: d.congress, stateDistricts: d.stateDistricts, local: d.local, approximate: false });
    if (d.stale) body.stale_districts = d.linkCongress;
    body.sources.district = "Saved districts (this link holds no address)";
    return json(body);
  } catch {
    return json({ error: "Couldn't load officials right now. Try again shortly." }, 502);
  }
}
