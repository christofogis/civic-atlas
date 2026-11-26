import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { voteMeaning, meaningKind, outcome, parseMeasure } from "../src/lib/voteMeaning.js";

const en = (v) => voteMeaning(v, "en").text;
const es = (v) => voteMeaning(v, "es").text;

const RULE_DESC = "Providing for consideration of the bill (H.R. 7176) Unlocking our Domestic LNG Potential Act";

test("passage, with what comes next from the measure's own type", () => {
  const v = { chamber: "house", question: "On Passage", result: "Passed", bill_type: "hr", bill_number: 1, yea_total: 218, nay_total: 214 };
  assert.equal(en(v), "A Yes vote was to pass H.R. 1. It passed, 218–214, so it goes to the Senate.");
  assert.equal(es(v), "Votar Sí significaba aprobar H.R. 1. Se aprobó, 218–214, así que pasa al Senado.");
  assert.equal(en({ chamber: "senate", question: "On Passage of the Bill H.R. 1", result: "Bill Passed (51-50, Vice President of the United States, voted Yea)" }),
    "A Yes vote was to pass H.R. 1. It passed, 51–50, with the Vice President breaking the tie. It had already passed the House.");
  assert.equal(en({ chamber: "house", question: "On Passage", result: "Failed", bill_type: "hr", bill_number: 9 }), "A Yes vote was to pass H.R. 9. It failed.");
  assert.equal(en({ chamber: "senate", question: "On the Resolution S.Res. 13", result: "Resolution Agreed to (97-0)" }),
    "A Yes vote was to adopt S.Res. 13. It passed, 97–0. It is a one-chamber resolution, so no other vote is needed.");
  assert.equal(en({ chamber: "senate", question: "On Passage of the Bill S. 316", result: "Bill Defeated (43-53, 3/5 majority required)" }),
    "A Yes vote was to pass S. 316, which needs 60 votes. It failed, 43–53.");
});

test("cloture: 60 on legislation, a simple majority on nominations", () => {
  assert.equal(en({ chamber: "senate", question: "On the Cloture Motion H.R. 1968", result: "Cloture Motion Rejected (52-48, 3/5 majority required)" }),
    "A Yes vote was to end debate on H.R. 1968 (cloture), which needs 60 votes. It failed, 52–48, so debate continues.");
  const nom = { chamber: "senate", question: "On the Cloture Motion PN150-3", result: "Cloture Motion Agreed to (51-43)", required: "1/2", document_name: "PN150-3",
    description: "Motion to Invoke Cloture: Whitney D. Hermandorfer to be U.S. Circuit Judge for the Sixth Circuit" };
  assert.equal(en(nom), "A Yes vote was to end debate on the nomination of Whitney D. Hermandorfer (cloture), which needs a simple majority. It passed, 51–43, so debate is limited and a vote can follow.");
  assert.match(es(nom), /^Votar Sí significaba terminar el debate sobre la nominación de Whitney D\. Hermandorfer \(cloture\), lo que requiere mayoría simple\. Se aprobó, 51–43/);
  assert.equal(en({ chamber: "senate", question: "On Cloture on the Motion to Proceed S. 1582", result: "Cloture on the Motion to Proceed Rejected (57-43, 3/5 majority required)" }),
    "A Yes vote was to end debate on whether to take up S. 1582 (cloture), which needs 60 votes. It failed, 57–43, so debate on taking it up continues.");
});

test("House procedure: recommit, table, previous question, rules", () => {
  assert.equal(en({ chamber: "house", question: "On Motion to Recommit", result: "Failed", bill_type: "hr", bill_number: 2270 }),
    "A Yes vote was to send H.R. 2270 back to committee (motion to recommit). It failed.");
  assert.equal(es({ chamber: "house", question: "On Motion to Recommit", result: "Failed", bill_type: "hr", bill_number: 2270 }),
    "Votar Sí significaba devolver H.R. 2270 al comité (moción para devolver al comité). No se aprobó.");
  assert.equal(en({ chamber: "house", question: "On Motion to Table", result: "Passed" }),
    "A Yes vote was to table (set aside) the pending motion. It passed, so it was set aside.");
  assert.equal(en({ chamber: "senate", question: "On the Motion to Table S.Amdt. 4234 to H.R. 7148 (No short title on file)", result: "Motion to Table Failed (48-50)" }),
    "A Yes vote was to table (set aside) amendment S.Amdt. 4234. It failed, 48–50, so it is still pending.");
  assert.equal(en({ chamber: "house", question: "On Ordering the Previous Question", result: "Passed", bill_type: "hres", bill_number: 1009, description: RULE_DESC }),
    "A Yes vote was to end debate on the rule H.Res. 1009 and vote on it (ordering the previous question). It passed, so the House moves to a vote on the rule.");
  assert.equal(en({ chamber: "house", question: "On Agreeing to the Resolution", result: "Passed", bill_type: "hres", bill_number: 1009, description: RULE_DESC, yea_total: 215, nay_total: 210 }),
    "A Yes vote was to adopt H.Res. 1009, a rule that sets the terms for debating other legislation; it is not a vote on that legislation. It passed, 215–210.");
  // The same wording without a rule description is an ordinary resolution.
  assert.equal(meaningKind({ chamber: "house", question: "On Agreeing to the Resolution", description: "Condemning ..." }), "adopt");
});

test("suspension of the rules and veto overrides need two-thirds", () => {
  assert.equal(en({ chamber: "house", question: "On Motion to Suspend the Rules and Pass, as Amended", result: "Passed", bill_type: "hr", bill_number: 3208, yea_total: 400, nay_total: 10 }),
    "A Yes vote was to pass H.R. 3208 under expedited rules (suspension of the rules), which needs two-thirds. It passed, 400–10, so it goes to the Senate.");
  assert.equal(en({ chamber: "house", question: "On Motion to Suspend the Rules and Concur in the Senate Amendment", result: "Passed", bill_type: "hr", bill_number: 5 }),
    "A Yes vote was to accept the Senate's changes to H.R. 5 under expedited rules (suspension of the rules), which needs two-thirds. It passed.");
  assert.equal(en({ chamber: "senate", question: "On Overriding the Veto S.J.Res. 11", result: "Veto Sustained (54-45, 2/3 majority required)" }),
    "A Yes vote was to pass S.J.Res. 11 over the President's veto, which needs two-thirds. It failed, 54–45, so the veto stands.");
  assert.equal(es({ chamber: "house", question: "Passage, Objections of the President To The Contrary Notwithstanding", result: "Failed", bill_type: "hr", bill_number: 5 }),
    "Votar Sí significaba aprobar H.R. 5 a pesar del veto del Presidente, lo que requiere dos tercios. No se aprobó, así que el veto se mantiene.");
});

test("amendments, concurrence and conference reports", () => {
  assert.equal(en({ chamber: "house", question: "On Agreeing to the Amendment", result: "Failed", bill_type: "hr", bill_number: 5, amendment_ref: "6" }),
    "A Yes vote was to adopt an amendment to H.R. 5. It failed.");
  assert.equal(en({ chamber: "senate", question: "On the Amendment S.Amdt. 3428 to S.Amdt. 3411 to H.R. 3944 (No short title on file)", result: "Amendment Rejected (21-75)" }),
    "A Yes vote was to adopt amendment S.Amdt. 3428 to H.R. 3944. It failed, 21–75.");
  assert.equal(es({ chamber: "senate", question: "On the Amendment S.Amdt. 3428 to S.Amdt. 3411 to H.R. 3944 (No short title on file)", result: "Amendment Rejected (21-75)" }),
    "Votar Sí significaba adoptar la enmienda S.Amdt. 3428 a H.R. 3944. No se adoptó, 21–75.");
  assert.equal(en({ chamber: "senate", question: "On the Motion (Motion to Concur in the House Amendment to the Senate Amendment to H.R. 2882)", result: "Motion Agreed to (74-24, 3/5 majority required)" }),
    "A Yes vote was to accept the House's changes to H.R. 2882, which needs 60 votes. It passed, 74–24.");
  assert.equal(en({ chamber: "house", question: "On Motion to Concur in the Senate Amendment with an Amendment", result: "Passed", bill_type: "hr", bill_number: 2882 }),
    "A Yes vote was to accept the Senate's changes to H.R. 2882, with further changes. It passed.");
  assert.equal(en({ chamber: "senate", question: "On the Conference Report H.R. 2670", result: "Conference Report Agreed to (87-13)" }),
    "A Yes vote was to approve the final version of H.R. 2670 agreed by House and Senate negotiators (conference report). It passed, 87–13.");
});

test("nominations and treaties", () => {
  const v = { chamber: "senate", question: "On the Nomination PN771", result: "Nomination Confirmed (64-22)", document_name: "PN771",
    description: "Confirmation: Brandon S. Long, of Louisiana, to be U.S. District Judge for the Eastern District of Louisiana" };
  assert.equal(en(v), "A Yes vote was to confirm Brandon S. Long. The nominee was confirmed, 64–22.");
  assert.equal(es(v), "Votar Sí significaba confirmar a Brandon S. Long. La persona nominada fue confirmada, 64–22.");
  assert.equal(en({ chamber: "senate", question: "On the Nomination PN22-9 and PN345-19", result: "Nominations Confirmed (51-47)" }),
    "A Yes vote was to confirm a group of nominations. They were confirmed, 51–47.");
  assert.equal(en({ chamber: "senate", question: "On the Resolution of Ratification Treaty Doc. 112-8", result: "Resolution of Ratification Agreed to (95-2, 2/3 majority required)" }),
    "A Yes vote was to approve the treaty (resolution of ratification), which needs two-thirds of senators present. It passed, 95–2.");
});

test("no Yes or No: Speaker elections and quorum calls", () => {
  assert.equal(en({ chamber: "house", question: "Election of the Speaker", result: "Jeffries" }), "Each member named a candidate for Speaker; there was no Yes or No.");
  assert.equal(es({ chamber: "house", question: "Call of the House", result: "Passed" }), "Llamada de quórum: los miembros registraron su presencia; no hubo Sí ni No.");
});

test("motions to proceed, discharge, waive, adjourn", () => {
  assert.equal(en({ chamber: "senate", question: "On the Motion to Proceed S.J.Res. 103", result: "Motion to Proceed Agreed to (45-38)" }),
    "A Yes vote was to begin considering S.J.Res. 103 (motion to proceed). It passed, 45–38, so the Senate takes it up.");
  assert.equal(en({ chamber: "senate", question: "On the Motion to Discharge S.J.Res. 104", result: "Motion to Discharge Rejected (49-51)" }),
    "A Yes vote was to take S.J.Res. 104 out of committee and bring it to the floor (motion to discharge). It failed, 49–51.");
  assert.equal(en({ chamber: "senate", question: "On the Motion (Motion to Waive All Applicable Budgetary Discipline Re: Alsobrooks Amdt. No. 5294)", result: "Motion Rejected (47-53, 3/5 majority required)" }),
    "A Yes vote was to waive a budget rule (point of order) so amendment S.Amdt. 5294 can proceed, which needs 60 votes. It failed, 47–53.");
  assert.equal(es({ chamber: "house", question: "On Motion to Adjourn", result: "Failed" }), "Votar Sí significaba levantar la sesión. No se aprobó.");
});

test("anything unrecognized falls back to the official question and result, verbatim", () => {
  const v = { chamber: "senate", question: "On the Point of Order S.J.Res. 124", result: "Point of Order Sustained (51-46)" };
  assert.deepEqual(voteMeaning(v, "en"), { kind: null, fallback: true, text: "The question was: On the Point of Order S.J.Res. 124. Result: Point of Order Sustained (51-46)." });
  assert.equal(es(v), "La pregunta fue: On the Point of Order S.J.Res. 124. Resultado: Point of Order Sustained (51-46).");
  // A result we can't read adds no outcome clause.
  assert.equal(en({ chamber: "house", question: "On Passage", result: "Something new", bill_type: "hr", bill_number: 2 }), "A Yes vote was to pass H.R. 2.");
});

test("helpers: outcome and measure parsing", () => {
  assert.equal(outcome("Veto Sustained (54-45, 2/3 majority required)"), "failed");
  assert.equal(outcome("Decision of Chair Not Sustained (45-53)"), "failed");
  assert.equal(outcome("Nomination Confirmed (99-0)"), "passed");
  assert.equal(outcome("Agreed to"), "passed");
  assert.equal(outcome("Jeffries"), null);
  assert.deepEqual(parseMeasure("S J RES 24"), { type: "sjres", number: 24 });
  assert.deepEqual(parseMeasure("H RES 83"), { type: "hres", number: 83 });
  assert.deepEqual(parseMeasure("H.J. Res. 45"), { type: "hjres", number: 45 });
  assert.equal(parseMeasure("PN771"), null);
});

test("real question wordings: under 1% of votes fall back", () => {
  const { groups } = JSON.parse(readFileSync(new URL("./fixtures/vote-questions.json", import.meta.url)));
  let total = 0, fallback = 0;
  for (const [chamber, question, rule, n] of groups) {
    total += n;
    const v = { chamber, question, result: "Passed", description: rule ? RULE_DESC : null };
    const r = voteMeaning(v, "en");
    if (r.fallback) fallback += n;
    assert.ok(r.text && !/undefined|null/.test(r.text), `${question} -> ${r.text}`);
    assert.ok(!/undefined|null/.test(voteMeaning(v, "es").text));
  }
  assert.equal(total, 3559);
  assert.ok(fallback / total < 0.01, `${fallback} of ${total} fall back`);
});
