// Matching state legislative districts between Open States ("3rd Suffolk", "Windsor-3-2", "039")
// and Geocodio's OCD division IDs ("ocd-division/country:us/state:ma/sldl:3rd_suffolk").
// Lowercase, letters and digits only, leading zeros dropped from each run of digits.
export const districtKey = (s) =>
  s == null ? null : String(s).toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(^|[a-z])0+(\d)/g, "$1$2");

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
