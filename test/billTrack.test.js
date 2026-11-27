import { test } from "node:test";
import assert from "node:assert/strict";
import { billTrack, trackSentence, trackShort } from "../lib/billTrack.js";

const NOW = new Date("2026-11-26T12:00:00Z"); // 119th Congress
const states = (t) => t.steps.map((s) => `${s.key}:${s.state}`);

test("a law: every step done, law number in the sentence, passage roll call linked", () => {
  const b = { congress: 119, bill_type: "hr", number: 1, title: "An Act", introduced_date: "2025-05-20",
    passed_house_date: "2025-05-22", passed_senate_date: "2025-07-01", presented_date: "2025-07-03",
    became_law_date: "2025-07-04", law_number: "Public Law 119-21" };
  const votes = [
    { vote_id: "h-1", chamber: "house", voted_at: "2025-05-22T10:00:00Z", question: "On Passage", source_url: "u1" },
    { vote_id: "h-2", chamber: "house", voted_at: "2025-05-22T09:00:00Z", question: "On Agreeing to the Amendment", source_url: "u2" },
  ];
  const t = billTrack(b, { votes, today: NOW });
  assert.equal(t.status, "law");
  assert.deepEqual(states(t), ["introduced:done", "committee:no_report", "house:done", "senate:done", "president:done", "law:done"]);
  assert.equal(t.steps[t.current].key, "law");
  assert.equal(t.steps[2].vote.vote_id, "h-1");
  assert.equal(t.steps[3].vote, null);
  assert.equal(trackSentence(t).en, "Became law on 2025-07-04 (Public Law 119-21).");
});

test("passed one chamber: Senate is the current step; schedule is used when it lists the bill", () => {
  const b = { congress: 119, bill_type: "hr", number: 5, introduced_date: "2025-02-01", reported_date: "2025-03-01", passed_house_date: "2025-04-01" };
  const t = billTrack(b, { referrals: [{ first_activity_date: "2025-02-01" }], today: NOW });
  assert.equal(t.status, "pending");
  assert.deepEqual(states(t), ["introduced:done", "committee:done", "house:done", "senate:current", "president:todo", "law:todo"]);
  assert.match(trackSentence(t).en, /^Next: the Senate would need to pass it\. No Senate vote/);
  assert.equal(trackShort(t).en, "Passed House, 2025-04-01");

  const s = { congress: 119, bill_type: "s", number: 9, introduced_date: "2025-02-01", passed_senate_date: "2025-04-01" };
  const sched = [{ kind: "floor", chamber: "house", event_date: "2026-11-30" }];
  assert.equal(trackSentence(billTrack(s, { scheduled: sched, today: NOW })).en,
    "Next: the House would need to pass it. Scheduled for a House vote the week of 2026-11-30.");
});

test("simple resolution agreed to: one chamber, no President", () => {
  const t = billTrack({ congress: 119, bill_type: "sres", number: 3, introduced_date: "2025-01-10", passed_senate_date: "2025-01-10" }, { today: NOW });
  assert.equal(t.status, "agreed");
  assert.deepEqual(t.steps.map((s) => s.key), ["introduced", "committee", "senate"]);
  assert.equal(trackSentence(t).en, "Agreed to in Senate on 2025-01-10. A simple resolution needs only one chamber.");
});

test("concurrent resolution ends after both chambers; amendment goes to the states", () => {
  const c = billTrack({ congress: 119, bill_type: "hconres", number: 2, introduced_date: "2025-01-03", passed_house_date: "2025-01-04", passed_senate_date: "2025-01-05" }, { today: NOW });
  assert.equal(c.status, "agreed");
  assert.ok(!c.steps.some((s) => s.key === "president"));
  const a = billTrack({ congress: 119, bill_type: "hjres", number: 7, title: "Proposing an amendment to the Constitution of the United States relative to ...", introduced_date: "2025-01-03" }, { today: NOW });
  assert.deepEqual(a.steps.map((s) => s.key), ["introduced", "committee", "house", "senate", "states"]);
  assert.equal(a.steps[1].state, "current");
  // An ordinary joint resolution goes to the President.
  const j = billTrack({ congress: 119, bill_type: "sjres", number: 1, title: "Providing for congressional disapproval ...", introduced_date: "2025-01-03" }, { today: NOW });
  assert.ok(j.steps.some((s) => s.key === "president"));
});

test("vetoed bill: veto is the last step, override explained", () => {
  const b = { congress: 119, bill_type: "s", number: 4, introduced_date: "2025-01-03", passed_senate_date: "2025-02-01",
    passed_house_date: "2025-03-01", presented_date: "2025-03-05", vetoed_date: "2025-03-10" };
  const t = billTrack(b, { today: NOW });
  assert.equal(t.status, "vetoed");
  assert.deepEqual(t.steps.map((s) => s.label), ["Introduced", "Reported by committee", "Passed Senate", "Passed House", "To President", "Vetoed"]);
  assert.equal(t.steps.at(-1).state, "failed");
  assert.match(trackSentence(t).en, /^Vetoed on 2025-03-10\. It becomes law only if two-thirds/);
});

test("vetoed bill whose override vote failed: the veto stands (H.R. 504, 119th)", () => {
  const b = { congress: 119, bill_type: "hr", number: 504, introduced_date: "2025-01-16", passed_house_date: "2025-07-14",
    passed_senate_date: "2025-12-10", presented_date: "2025-12-17", vetoed_date: "2025-12-29" };
  const votes = [{ vote_id: "house-119-2-8", chamber: "house", voted_at: "2026-01-08T20:17:00+00:00",
    question: "Passage, Objections of the President To The Contrary Notwithstanding", result: "Failed" }];
  const t = billTrack(b, { votes, today: NOW });
  assert.equal(t.status, "vetoed");
  assert.deepEqual(t.override, { chamber: "house", date: "2026-01-08", vote_id: "house-119-2-8", source_url: undefined });
  assert.match(trackSentence(t).en, /^Vetoed on 2025-12-29\. On 2026-01-08 the House voted on overriding the veto; .*the veto stands\.$/);
  // A Senate override that was sustained reads the same way.
  const s = billTrack(b, { votes: [{ chamber: "senate", voted_at: "2026-01-09T15:00:00Z", question: "On Overriding the Veto H.R. 504", result: "Veto Sustained (50-50, 2/3 majority required)" }], today: NOW });
  assert.equal(s.override.chamber, "senate");
});

test("died at the end of a Congress", () => {
  const b = { congress: 118, bill_type: "hr", number: 77, introduced_date: "2023-03-01", passed_house_date: "2023-06-01" };
  const t = billTrack(b, { today: NOW });
  assert.equal(t.status, "ended");
  assert.ok(!t.steps.some((s) => s.state === "current"));
  assert.equal(t.steps[t.current].key, "house");
  assert.equal(trackSentence(t).en, "The 118th Congress ended without it becoming law. To move forward it would have to be introduced again.");
  assert.equal(trackShort(t).en, "Passed House, 2023-06-01 · the 118th Congress ended");
  const f = billTrack({ ...b, passed_house_date: null, failed_house_date: "2023-06-01" }, { today: NOW });
  assert.equal(trackSentence(f).en, "Failed in the House on 2023-06-01. The 118th Congress ended without it becoming law.");
});

test("incomplete data: missing dates before a later step are unknown, never filled in", () => {
  const t = billTrack({ congress: 119, bill_type: "hr", number: 8, introduced_date: null, became_law_date: "2025-09-01" }, { today: NOW });
  assert.equal(t.status, "law");
  assert.deepEqual(states(t), ["introduced:unknown", "committee:no_report", "house:unknown", "senate:unknown", "president:unknown", "law:done"]);
  const none = billTrack({ congress: 119, bill_type: "hr", number: 9 }, { today: NOW });
  assert.equal(none.status, "unknown");
  assert.equal(trackShort(none).en, "Stage not in the record");
  assert.match(trackSentence(none).en, /can't be determined/);
});

test("sent to the President: signing or veto is next", () => {
  const t = billTrack({ congress: 119, bill_type: "hr", number: 10, introduced_date: "2025-01-03", passed_house_date: "2025-02-01", passed_senate_date: "2025-03-01", presented_date: "2026-11-20" }, { today: NOW });
  assert.equal(t.steps[t.current].key, "law");
  assert.match(trackSentence(t).en, /^Sent to the President on 2026-11-20\. Next: the President signs or vetoes it\./);
});
