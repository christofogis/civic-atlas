import { tr } from "./lang.js";

// Local offices (pilot: Orange County, CA). County offices in California are nonpartisan, so
// these cards carry no party badge, for anyone.
const OFFICES = {
  assessor: ["Assessor", "Tasador(a)"],
  auditor_controller: ["Auditor-Controller", "Auditor(a)-Contralor(a)"],
  clerk_recorder: ["Clerk-Recorder", "Secretario(a)-Registrador(a)"],
  district_attorney: ["District Attorney-Public Administrator", "Fiscal de Distrito-Administrador(a) Público(a)"],
  sheriff_coroner: ["Sheriff-Coroner", "Alguacil-Médico(a) Forense"],
  treasurer_tax_collector: ["Treasurer-Tax Collector", "Tesorero(a)-Recaudador(a) de Impuestos"],
};
export const officeName = (o) => tr(...(OFFICES[o] ?? [o, o]));
// "Orange County" -> "Condado de Orange" for Spanish text.
export const countyEs = (county) => `Condado de ${county.replace(/ County$/, "")}`;
export const supervisorParts = (county, d) => [tr(`${county} Board of Supervisors`, `Junta de Supervisores del Condado de ${county.replace(/ County$/, "")}`), tr(`District ${d}`, `Distrito ${d}`)];
export const supervisorSeat = (county, d) => supervisorParts(county, d).join(", ");
export const roleName = (r) => (r === "chair" ? tr("Chair", "Presidente(a)") : r === "vice_chair" ? tr("Vice Chair", "Vicepresidente(a)") : null);

// A term that has ended with no newer record means the file is behind: show the seat as updating.
export const termEnded = (s) => Boolean(s.term_end && s.term_end < new Date().toISOString().slice(0, 10));

let cache = {};
export function loadLocal(id) {
  cache[id] ??= fetch(`/data/local/${id}.json`).then((r) => r.json());
  return cache[id];
}

export const councilRole = (r) => (r === "mayor" ? tr("Mayor", "Alcalde(sa)") : r === "mayor_pro_tem" ? tr("Mayor Pro Tem", "Alcalde(sa) Pro Tem") : null);
export const councilParts = (city, d) => [tr(`${city} City Council`, `Concejo Municipal de ${city}`), d ? tr(`District ${d}`, `Distrito ${d}`) : tr("Elected citywide", "Elegido en toda la ciudad")];
export const councilSeat = (city, d) => councilParts(city, d).join(", ");
const today = () => new Date().toISOString().slice(0, 10);
// A seat on the ballot: once its change-over date passes with no update, it shows as updating.
export const seatUpdating = (m) => Boolean(m.on_ballot && m.seat_change_by && m.seat_change_by < today());
// The council picks its mayor each December; past roles_until, titles aren't shown until updated.
export const rolesCurrent = (city) => !city.roles_until || city.roles_until >= today();

// The Board of Supervisors' minutes as read (Orange County only), loaded once per page.
let minutesCache = null;
export function loadMinutes() {
  minutesCache ??= fetch("/data/local/ca-orange-minutes.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return minutesCache;
}
