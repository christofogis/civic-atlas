import test from "node:test";
import assert from "node:assert/strict";
import { registrationLinks, savedState } from "../lib/firstVoter.js";

test("vote.gov comes first for every visitor, in their language", () => {
  assert.deepEqual(registrationLinks(null), [{ id: "vote.gov", url: "https://vote.gov/" }]);
  assert.deepEqual(registrationLinks("TX", "es"), [{ id: "vote.gov", url: "https://vote.gov/es/" }]);
});

test("California adds the Secretary of State's links", () => {
  const en = registrationLinks("CA");
  assert.deepEqual(en.map((l) => l.id), ["vote.gov", "ca-register", "ca-status", "ca-preregister"]);
  assert.equal(en[1].url, "https://registertovote.ca.gov/");
  assert.equal(en[2].url, "https://voterstatus.sos.ca.gov/");
  const es = registrationLinks("CA", "es");
  assert.equal(es[1].url, "https://registertovote.ca.gov/es");
  assert.equal(es[2].url, "https://voterstatus.sos.ca.gov/"); // no Spanish address: the same page
});

test("state from a saved lookup", () => {
  assert.equal(savedState("st=CA&cg=120&cd=47"), "CA");
  assert.equal(savedState("st=ny"), "NY");
  assert.equal(savedState(null), null);
  assert.equal(savedState("cg=120"), null);
  assert.equal(savedState("st=California"), null);
});
