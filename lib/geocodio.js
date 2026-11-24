// Turn a Geocodio /v2.1/geocode response (with fields=cd) into the districts for the
// best-matching result. Pure function so it can be tested without network access.
//
// Geocodio returns the congressional districts for the Congress currently in session by
// default (it switches to the 120th on Jan 3, 2027). A ZIP code or imprecise address can
// match more than one district; all are returned, largest overlap first.
export function districtsFromGeocodio(json) {
  const result = json?.results?.[0];
  if (!result) return null;
  // API v2 renamed `state` to `state_province`; accept either.
  const ac = result.address_components ?? {};
  const state = ac.state_province ?? ac.state ?? null;
  const cds = (result.fields?.congressional_districts ?? [])
    .slice()
    .sort((a, b) => (b.proportion ?? 1) - (a.proportion ?? 1));
  return {
    state,
    matched_address: result.formatted_address ?? null,
    accuracy_type: result.accuracy_type ?? null,
    congress: cds[0]?.congress_number ? parseInt(cds[0].congress_number, 10) : null,
    // Geocodio numbers at-large seats 0 (some sources use 98); the lookup treats a state's
    // single House seat as at-large either way.
    districts: [...new Set(cds.map((d) => Number(d.district_number)).filter((n) => Number.isFinite(n)))],
  };
}
