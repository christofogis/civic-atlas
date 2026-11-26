import { test } from "node:test";
import assert from "node:assert/strict";
import { boardRecords, partialLine, supervisorRecord, surname } from "../lib/boardVotes.js";

const all = ["Nguyen", "Sarmiento", "Wagner", "Chaffee", "Foley"];
const minutes = {
  meetings: [
    { date: "2026-11-17", time: "09:30", minutes_url: "u1", items: [
      { number: "1", text: "Item one", actions: [{ motion: "M", votes: { Ayes: all } }] },
      { number: "4", text: "Item four", actions: [{ motion: "M", votes: { Ayes: ["Sarmiento"], Noes: ["Nguyen", "Wagner"] } }] },
      { number: "5", text: "Item five", actions: [{ motion: "BOARD ORDER, CONTINUED", votes: {} }] },
    ] },
    { date: "2026-11-13", time: "14:00", special: true, minutes_url: "u2", items: [
      { number: "CS1", text: "Closed", actions: [{ motion: "ON A VOTE OF 3 TO 0, WITH ...", votes: {}, vote_in_text: true }] },
    ] },
    { date: "2026-11-03", time: "09:30", minutes_url: "u3", items: [
      { number: "2", text: "Item two", actions: [{ motion: "M", votes: { Ayes: ["Nguyen", "Sarmiento", "Wagner", "Foley"], Excused: ["Chaffee"] } }] },
    ] },
  ],
};

test("surname from full name", () => {
  assert.equal(surname("Donald P. Wagner"), "Wagner");
  assert.equal(surname("Janet Nguyen"), "Nguyen");
});

test("partial vote line", () => {
  assert.equal(partialLine({ votes: { Ayes: all } }), false);
  assert.equal(partialLine({ votes: { Ayes: ["Sarmiento"], Noes: ["Nguyen", "Wagner"] } }), true);
  assert.equal(partialLine({ votes: {} }), false);
});

test("one supervisor's record", () => {
  const r = supervisorRecord(minutes, "Donald P. Wagner");
  assert.deepEqual(r.counts, { Ayes: 2, Noes: 1, Abstained: 0, Absent: 0, Excused: 0 });
  assert.equal(r.other.length, 1);
  assert.equal(r.other[0].number, "4");
  assert.equal(r.other[0].partial, true);
  assert.equal(r.unnamed, 0);
  assert.equal(r.inText.length, 1);
  assert.equal(r.inText[0].special, true);
  assert.equal(r.meetings, 3);
  assert.equal(r.from, "2026-11-03");
});

test("motions that leave a supervisor out are counted apart", () => {
  const r = supervisorRecord(minutes, "Katrina Foley");
  assert.equal(r.unnamed, 1);
  assert.deepEqual(r.counts, { Ayes: 2, Noes: 0, Abstained: 0, Absent: 0, Excused: 0 });
  const c = supervisorRecord(minutes, "Doug Chaffee");
  assert.equal(c.counts.Excused, 1);
  assert.equal(c.other[0].kind, "Excused");
  assert.equal(c.other[0].partial, false);
});

test("board records agree with each supervisor's", () => {
  const b = boardRecords(minutes);
  assert.deepEqual(b.map((r) => r.name), ["Chaffee", "Foley", "Nguyen", "Sarmiento", "Wagner"]);
  assert.deepEqual(b.find((r) => r.name === "Wagner").counts, supervisorRecord(minutes, "Donald P. Wagner").counts);
});
