import { test } from "node:test";
import assert from "node:assert/strict";
import { containing } from "../lib/geo.js";

const square = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
const features = [
  { properties: { district: 1 }, geometry: { type: "Polygon", coordinates: [square(0, 0, 10, 10), square(4, 4, 6, 6)] } },
  { properties: { district: 2 }, geometry: { type: "MultiPolygon", coordinates: [[square(20, 0, 30, 10)], [square(40, 0, 50, 10)]] } },
];

test("point in polygon, with holes and multipolygons", () => {
  assert.equal(containing(features, 2, 2)?.properties.district, 1);
  assert.equal(containing(features, 5, 5), null);          // in the hole
  assert.equal(containing(features, 45, 5)?.properties.district, 2);
  assert.equal(containing(features, 15, 5), null);
});
