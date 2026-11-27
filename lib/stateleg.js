// Matching state legislative districts between Open States ("3rd Suffolk", "Windsor-3-2", "039")
// and Geocodio's OCD division IDs ("ocd-division/country:us/state:ma/sldl:3rd_suffolk").
// Lowercase, ordinal words as numbers ("Third Suffolk" = "3rd Suffolk"; Massachusetts uses both),
// letters and digits only, leading zeros dropped from each number.
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];
const SUFFIX = (n) => (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th");
export const districtKey = (s) => {
  if (s == null) return null;
  return String(s).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    .map((w) => { const i = ORDINALS.indexOf(w); return i < 0 ? w : `${i + 1}${SUFFIX(i + 1)}`; })
    .map((w) => w.replace(/^0+(\d)/, "$1"))
    .join("");
};

// Geocodio's `stateleg` field -> { upper: [keys], lower: [keys] }, current districts only,
// largest overlap first. Nebraska's single chamber comes back as "senate".
export function stateDistrictsFromGeocodio(json) {
  const f = json?.results?.[0]?.fields?.state_legislative_districts;
  if (!f) return { upper: [], lower: [] };
  const keys = (list) => [...new Set((list ?? [])
    .filter((d) => !d.is_upcoming_state_legislative_district)
    .sort((a, b) => (b.proportion ?? 1) - (a.proportion ?? 1))
    .map((d) => districtKey((d.ocd_id ?? "").split(":").pop() || d.district_number))
    .filter(Boolean))];
  return { upper: keys(f.senate), lower: keys(f.house) };
}

// Statewide offices shown for every state. Open States lists these consistently; other elected
// statewide offices (treasurer, controller, ...) appear for only a few states, so they're left
// out until every state has them.
export const STATEWIDE = ["governor", "lt_governor", "attorney general", "secretary of state", "chief election officer"];

// The address's legislative districts with nobody listed in them (a vacancy, or a new member Open
// States hasn't added yet), so the lookup can say so instead of leaving the seat out. Only districts
// with no one at all are reported; Nebraska's (and D.C.'s) single chamber is "legislature".
export function emptySeats(st, officials, districts) {
  const upperType = st === "NE" || st === "DC" ? "legislature" : "upper";
  const held = (types, key) => (officials ?? []).some((o) => types.includes(o.type) && districtKey(o.district) === key);
  return [
    ...(districts?.upper ?? []).filter((k) => !held(["upper", "legislature"], k)).map((key) => ({ type: upperType, key })),
    ...(districts?.lower ?? []).filter((k) => !held(["lower"], k)).map((key) => ({ type: "lower", key })),
  ];
}
