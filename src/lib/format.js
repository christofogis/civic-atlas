// Shared, neutral formatting helpers. Keep wording descriptive and identical for everyone.
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
const TERRITORIES = new Set(["DC", "PR", "GU", "VI", "AS", "MP"]);

export function seatLabel(s) {
  const state = STATE_NAMES[s.state] ?? s.state;
  if (s.chamber === "senate") return `U.S. Senator, ${state}`;
  if (s.state === "PR") return "Resident Commissioner, Puerto Rico";
  if (TERRITORIES.has(s.state)) return `Delegate, ${state}`;
  return s.district === 0 ? `U.S. Representative, ${state} at-large` : `U.S. Representative, ${state} District ${s.district}`;
}

export const date = (d) =>
  d ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";

export const money = (n) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const billLabel = (b) => {
  const t = { hr: "H.R.", s: "S.", hres: "H.Res.", sres: "S.Res.", hjres: "H.J.Res.", sjres: "S.J.Res.", hconres: "H.Con.Res.", sconres: "S.Con.Res." };
  return `${t[b.bill_type] ?? b.bill_type} ${b.number}`;
};

export function ordinal(n) {
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
