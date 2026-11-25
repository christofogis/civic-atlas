// A lookup's districts as link parameters: state, congressional district(s), state legislative
// districts, and (Orange County) supervisor district, city or community, and council district.
// No address and no coordinates, so a saved or shared link says no more than a district map does.
const KEY = "civic-atlas:my-districts";

export function districtParams(r) {
  // cg: the Congress whose House districts these are (district numbers change with new lines).
  const p = new URLSearchParams({ st: r.state, cg: String(r.congress ?? "") });
  if (r.districts?.length) p.set("cd", r.districts.join(","));
  if (r.state_districts?.upper?.length) p.set("su", r.state_districts.upper.join(","));
  if (r.state_districts?.lower?.length) p.set("sl", r.state_districts.lower.join(","));
  const l = r.local;
  if (l?.covered) {
    p.set("co", l.id);
    if (l.supervisor_district) p.set("sd", String(l.supervisor_district));
    if (l.place) { if (l.place.name) p.set("pl", l.place.name); p.set("pt", l.place.type === "city" ? "c" : "u"); }
    if (l.city?.council_district) p.set("cc", String(l.city.council_district));
  }
  return p.toString();
}

export const officialsPath = (r) => `/officials?${districtParams(r)}`;

export function saveDistricts(r) {
  try { localStorage.setItem(KEY, districtParams(r)); } catch { /* storage unavailable */ }
}
export function savedDistricts() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function forgetDistricts() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
