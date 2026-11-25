import { test } from "node:test";
import assert from "node:assert/strict";
import { districtKey, stateDistrictsFromGeocodio } from "../lib/stateleg.js";

test("district keys match between Open States names and OCD IDs", () => {
  assert.equal(districtKey("3rd Suffolk"), districtKey("3rd_suffolk"));
  assert.equal(districtKey("Windsor-3-2"), districtKey("windsor-3-2"));
  assert.equal(districtKey("039"), districtKey("39"));
  assert.equal(districtKey("Hillsborough 12"), districtKey("hillsborough_12"));
  assert.notEqual(districtKey("1"), districtKey("10"));
  assert.equal(districtKey(null), null);
  assert.equal(districtKey("Third Suffolk"), districtKey("3rd_suffolk"));
  assert.equal(districtKey("First Suffolk and Middlesex"), districtKey("1st_suffolk_and_middlesex"));
  assert.equal(districtKey("Eleventh Essex"), districtKey("11th Essex"));
  assert.equal(districtKey("Twelfth Worcester"), "12thworcester");
});

test("Geocodio stateleg field: current districts, largest overlap first", () => {
  const json = { results: [{ fields: { state_legislative_districts: {
    house: [
      { district_number: "72", ocd_id: "ocd-division/country:us/state:ca/sldl:72", proportion: 0.3, is_upcoming_state_legislative_district: false },
      { district_number: "70", ocd_id: "ocd-division/country:us/state:ca/sldl:70", proportion: 0.7, is_upcoming_state_legislative_district: false },
      { district_number: "71", ocd_id: "ocd-division/country:us/state:ca/sldl:71", proportion: 1, is_upcoming_state_legislative_district: true },
    ],
    senate: [{ district_number: "36", ocd_id: "ocd-division/country:us/state:ca/sldu:36", proportion: 1 }],
  } } }] };
  assert.deepEqual(stateDistrictsFromGeocodio(json), { upper: ["36"], lower: ["70", "72"] });
  assert.deepEqual(stateDistrictsFromGeocodio({ results: [{}] }), { upper: [], lower: [] });
});
