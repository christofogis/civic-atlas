import { test } from "node:test";
import assert from "node:assert/strict";
import { versionCode, textVersions, sectionsFromXml, compareSections } from "../lib/billtext.js";

const bill = (body) => `<?xml version="1.0"?><bill><legis-body>${body}</legis-body></bill>`;
const sec = (n, h, t) => `<section><enum>${n}.</enum><header>${h}</header><text>${t}</text></section>`;

test("version codes", () => {
  assert.equal(versionCode("https://www.govinfo.gov/content/pkg/BILLS-119hr1eh/xml/BILLS-119hr1eh.xml"), "eh");
  assert.equal(versionCode("https://www.govinfo.gov/content/pkg/BILLS-119sjres12enr/xml/BILLS-119sjres12enr.xml"), "enr");
  assert.equal(versionCode("https://www.govinfo.gov/content/pkg/PLAW-119publ21/uslm/PLAW-119publ21.xml"), "law");
});

test("version order: dated, then enrolled, then law", () => {
  const items = [
    { type: "Enrolled Bill", date: "", formats: { item: [{ url: "https://x/content/pkg/BILLS-119s5enr/xml/BILLS-119s5enr.xml" }] } },
    { type: "Engrossed in Senate", date: "2025-01-20T05:00:00Z", formats: { item: { url: "https://x/content/pkg/BILLS-119s5es/xml/BILLS-119s5es.xml" } } },
    { type: "Public Law", date: "2025-01-30T04:59:59Z", formats: { item: { url: "https://x/content/pkg/PLAW-119publ1/uslm/PLAW-119publ1.xml" } } },
    { type: "Placed on Calendar Senate", date: "2025-01-07T05:00:00Z", formats: { item: { url: "https://x/content/pkg/BILLS-119s5pcs/xml/BILLS-119s5pcs.xml" } } },
  ];
  const rows = textVersions(items, { congress: 119, bill_type: "s", number: 5, presented_date: "2025-01-23" });
  assert.deepEqual(rows.map((r) => [r.version_code, r.seq, r.version_date]), [["pcs", 1, "2025-01-07"], ["es", 2, "2025-01-20"], ["enr", 3, "2025-01-23"], ["law", 4, "2025-01-30"]]);
});

test("sections: renumbering is not a change; deleted text and quoted blocks are skipped", () => {
  const a = sectionsFromXml(bill(sec(1, "Short title", "This Act may be cited as the X Act.") + sec(2, "Definitions", "In this Act, the term A means B.") + sec(3, "Repeal", "Section 5 is repealed.")));
  const b = sectionsFromXml(bill(
    sec(1, "Short title", "This Act may be cited as the X Act.") +
    sec(2, "Funding", "There are authorized $5.") +
    `<section><enum>3.</enum><header>Definitions</header><text>In this Act, the term A means <deleted-phrase>B</deleted-phrase> C.</text>` +
      `<quoted-block><section><enum>9.</enum><header>Inserted into code</header><text>Q</text></section></quoted-block></section>`));
  const c = compareSections(a, b);
  assert.deepEqual([c.added_count, c.removed_count, c.changed_count, c.unchanged_count], [1, 1, 1, 1]);
  assert.equal(c.added[0].header, "Funding");
  assert.equal(c.removed[0].header, "Repeal");
  assert.equal(c.changed[0].header, "Definitions");
  assert.equal(b.length, 3);   // the section inside the quoted block is part of "Definitions"
});

test("titles become the path; duplicate headings are told apart", () => {
  const s = sectionsFromXml(bill(`<title><enum>I</enum><header>Agriculture</header>${sec(101, "Definitions", "a")}</title><title><enum>II</enum><header>Energy</header>${sec(201, "Definitions", "b")}${sec(202, "Definitions", "c")}</title>`));
  assert.deepEqual(s.map((x) => x.key), ["agriculture > definitions", "energy > definitions", "energy > definitions #2"]);
});

test("amendment-only documents and bodies without sections", () => {
  assert.equal(sectionsFromXml(`<amendment-doc><engrossed-amendment-body><text>Strike all</text></engrossed-amendment-body></amendment-doc>`), null);
  const r = sectionsFromXml(`<resolution><resolution-body><text>Resolved, That the House honors X.</text></resolution-body></resolution>`);
  assert.equal(r[0].header, "Full text");
});

test("Senate reported: struck body and committee body", () => {
  const xml = `<bill><legis-body><section changed="deleted"><enum>1.</enum><header>Old</header><text>old text</text></section></legis-body>` +
    `<legis-body><section changed="added"><enum>1.</enum><header>New</header><text>new text here</text></section></legis-body></bill>`;
  assert.deepEqual(sectionsFromXml(xml).map((s) => [s.header, s.words]), [["New", 4]]);
});

test("renamed titles: sections still match by heading", () => {
  const a = sectionsFromXml(bill(`<title><enum>I</enum><header>Committee on Agriculture</header>${sec(101, "Thrifty food plan", "x")}</title>`));
  const b = sectionsFromXml(bill(`<title><enum>I</enum><header>Committee on Agriculture, Nutrition, and Forestry</header>${sec(10101, "Thrifty food plan", "y")}</title>`));
  const c = compareSections(a, b);
  assert.deepEqual([c.added_count, c.removed_count, c.changed_count], [0, 0, 1]);
});
