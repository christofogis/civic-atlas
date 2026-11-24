import { test } from "node:test";
import assert from "node:assert/strict";
import { setCurrentLang } from "../src/lib/lang.js";
import { seatLabel, ordinal, partyName } from "../src/lib/format.js";
import { voteKind } from "../src/lib/voteKind.js";

test("Spanish formatting and labels; English unchanged", () => {
  setCurrentLang("es");
  assert.equal(seatLabel({ chamber: "house", state: "NY", district: 12 }), "Cámara de Representantes de EE. UU., Nueva York, distrito 12");
  assert.equal(ordinal(119), "119.º");
  assert.equal(partyName("Republican"), "Republicano");
  assert.equal(voteKind({ question: "On the Nomination" }).label, "Confirmación");
  setCurrentLang("en");
  assert.equal(seatLabel({ chamber: "senate", state: "CA" }), "U.S. Senator, California");
  assert.equal(ordinal(119), "119th");
  assert.equal(voteKind({ question: "On the Nomination" }).label, "Confirmation");
});
