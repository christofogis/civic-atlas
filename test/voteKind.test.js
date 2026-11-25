import { test } from "node:test";
import assert from "node:assert/strict";
import { positionMeaning } from "../src/lib/voteKind.js";

test("what a position meant, by the kind of vote", () => {
  assert.equal(positionMeaning({ question: "On Passage" }, "Yea"), "to pass it");
  assert.equal(positionMeaning({ question: "On Passage" }, "Nay"), "against passing it");
  assert.equal(positionMeaning({ question: "On the Cloture Motion" }, "Yea"), "to end debate and move toward a final vote");
  assert.equal(positionMeaning({ question: "On Motion to Table" }, "Nay"), "against setting it aside");
  assert.equal(positionMeaning({ question: "On the Nomination" }, "Yea"), "to confirm the nominee");
  assert.equal(positionMeaning({ chamber: "house", question: "On Agreeing to the Resolution", description: "Providing for consideration of H.R. 1" }, "Aye"), "to adopt the terms for debating another bill");
  assert.equal(positionMeaning({ question: "On Passage" }, "Not Voting"), "didn't vote");
  assert.equal(positionMeaning({ question: "Election of the Speaker" }, "Jeffries"), null);
});
