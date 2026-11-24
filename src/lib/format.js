// Shared, neutral formatting helpers. Keep wording descriptive and identical for everyone.
import { tr, locale } from "./lang.js";
export const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
  UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
  WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia", PR: "Puerto Rico", GU: "Guam",
  VI: "U.S. Virgin Islands", AS: "American Samoa", MP: "Northern Mariana Islands",
};
// Spanish names where they differ from English (as used by the U.S. government in Spanish).
const STATE_NAMES_ES = {
  HI: "Hawái", LA: "Luisiana", NJ: "Nueva Jersey", NM: "Nuevo México", NY: "Nueva York", NC: "Carolina del Norte",
  ND: "Dakota del Norte", PA: "Pensilvania", SC: "Carolina del Sur", SD: "Dakota del Sur", WV: "Virginia Occidental",
  DC: "Distrito de Columbia", VI: "Islas Vírgenes de EE. UU.", AS: "Samoa Estadounidense", MP: "Islas Marianas del Norte",
};
export const stateName = (st) => tr(STATE_NAMES[st] ?? st, STATE_NAMES_ES[st] ?? STATE_NAMES[st] ?? st);
// Party as recorded, with the Spanish name when the site is in Spanish.
export const partyName = (p) => tr(p, { Democrat: "Demócrata", Republican: "Republicano", Independent: "Independiente", Libertarian: "Libertario" }[p] ?? p);
const TERRITORIES = new Set(["DC", "PR", "GU", "VI", "AS", "MP"]);

export function seatLabel(s) {
  const state = stateName(s.state);
  if (s.chamber === "senate") return tr(`U.S. Senator, ${state}`, `Senado de EE. UU., ${state}`);
  if (s.state === "PR") return tr("Resident Commissioner, Puerto Rico", "Comisionado(a) Residente, Puerto Rico");
  if (TERRITORIES.has(s.state)) return tr(`Delegate, ${state}`, `Delegado(a) ante la Cámara, ${state}`);
  return s.district === 0
    ? tr(`U.S. Representative, ${state} at-large`, `Cámara de Representantes de EE. UU., ${state}, distrito único`)
    : tr(`U.S. Representative, ${state} District ${s.district}`, `Cámara de Representantes de EE. UU., ${state}, distrito ${s.district}`);
}

export const date = (d) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString(locale(), { year: "numeric", month: "short", day: "numeric" }) : "";

export const money = (n) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const billLabel = (b) => {
  const t = { hr: "H.R.", s: "S.", hres: "H.Res.", sres: "S.Res.", hjres: "H.J.Res.", sjres: "S.J.Res.", hconres: "H.Con.Res.", sconres: "S.Con.Res." };
  return `${t[b.bill_type] ?? b.bill_type} ${b.number}`;
};

export function ordinal(n) {
  if (tr("en", "es") === "es") return `${n}.º`;
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// "R-TX-19", "D-CA", "I-VT": party initial, state, and House district (none for senators,
// delegates or at-large seats). Same form for everyone.
export function partyTag(p) {
  const party = { Democrat: "D", Republican: "R", Independent: "I", Libertarian: "L" }[p.party] ?? p.party?.[0] ?? "?";
  const district = p.chamber === "house" && p.district > 0 && !TERRITORIES.has(p.state) ? `-${p.district}` : "";
  return `${party}-${p.state}${district}`;
}

// "Committee on Commerce, Science, and Transportation" -> "Commerce, Science, and Transportation"
// for tight lists; the full official name stays on the committee's own page.
export const shortCommittee = (name) => String(name ?? "").replace(/^(House |Senate |Joint )?(Select |Special |Permanent Select )?Committee on (the )?/i, "").replace(/^(House|Senate) /, "");
