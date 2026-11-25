// Districts from a saved or shared link (st, cg, cd, su, sl, bo, co, sd, pl, pt, cc), checked and
// normalized. Shared by /api/officials and the "Your week" calendar feed. Null without a state.
import { LOCAL, localFromSaved } from "./officials.js";
import { congressOn } from "./congress.js";

const list = (v, re) => (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter((s) => re.test(s)).slice(0, 4);

export function savedDistrictsFrom(p) {
  const st = (p.get("st") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(st)) return null;
  // House districts belong to one Congress's lines. A link from an earlier Congress (or from
  // before links carried cg, which were all 119th) keeps its state and local districts but
  // drops the House district, and says so.
  const current = congressOn();
  const linkCongress = /^\d{3}$/.test(p.get("cg") ?? "") ? Number(p.get("cg")) : 119;
  const stale = linkCongress !== current;
  const districts = stale ? [] : list(p.get("cd"), /^\d{1,2}$/).map(Number);
  const stateDistricts = { upper: list(p.get("su"), /^[a-z0-9]{1,40}$/), lower: list(p.get("sl"), /^[a-z0-9]{1,40}$/),
    boe: st === "CA" ? list(p.get("bo"), /^[1-4]$/).map(Number) : [] };
  const int = (k) => (/^\d{1,2}$/.test(p.get(k) ?? "") ? Number(p.get(k)) : null);
  const co = p.get("co");
  const pl = (p.get("pl") ?? "").slice(0, 60);
  const local = co && Object.values(LOCAL).some((c) => c.id === co)
    ? localFromSaved({ co, sd: int("sd"), pl: /^[A-Za-z .'-]+$/.test(pl) ? pl : null, pt: p.get("pt"), cc: int("cc") })
    : { covered: false, county: null };
  return { state: st, districts, congress: current, stateDistricts, local, stale, linkCongress };
}
