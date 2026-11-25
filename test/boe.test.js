import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { boeFor } from "../lib/officials.js";

const load = async (path) => JSON.parse(readFileSync(`public${path}`, "utf8"));

test("California BOE district from a point", async () => {
  assert.deepEqual(await boeFor("CA", { lat: 33.8031, lng: -118.0726 }, load), [4]); // Los Alamitos
  assert.deepEqual(await boeFor("CA", { lat: 37.7749, lng: -122.4194 }, load), [2]); // San Francisco
  assert.deepEqual(await boeFor("CA", { lat: 34.0522, lng: -118.2437 }, load), [3]); // Los Angeles
  assert.deepEqual(await boeFor("CA", { lat: 38.5816, lng: -121.4944 }, load), [1]); // Sacramento
});

test("no BOE district outside California or without a point", async () => {
  assert.deepEqual(await boeFor("NV", { lat: 36.17, lng: -115.14 }, load), []);
  assert.deepEqual(await boeFor("CA", null, load), []);
});
