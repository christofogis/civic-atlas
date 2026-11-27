import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fold, parseBillQuery, numberPrefixRanges, rangesFilter, congressesSince118, prefixTsquery,
  matchMembers, matchByWords, pickRows, highlightParts,
} from "../src/lib/suggest.js";

test("bill numbers are read from the whole box, in the ways people type them", () => {
  assert.deepEqual(parseBillQuery("H.R. 1"), { bill_type: "hr", number: 1, digits: "1" });
  assert.equal(parseBillQuery("hr1").bill_type, "hr");
  assert.equal(parseBillQuery("S 5").bill_type, "s");
  assert.equal(parseBillQuery("s.5").bill_type, "s");
  assert.deepEqual(parseBillQuery("H.Res. 757"), { bill_type: "hres", number: 757, digits: "757" });
  assert.equal(parseBillQuery("hjres 12").bill_type, "hjres");
  assert.equal(parseBillQuery("H. Con. Res. 3").bill_type, "hconres");
  assert.equal(parseBillQuery("S.J.Res.9").bill_type, "sjres");
  assert.equal(parseBillQuery(" H.R. 15 ").number, 15);
  // Not bill numbers: words, a prefix with no number, a number with words after it, zero.
  assert.equal(parseBillQuery("Sanders"), null);
  assert.equal(parseBillQuery("H.R."), null);
  assert.equal(parseBillQuery("H.R. 1 farm"), null);
  assert.equal(parseBillQuery("hr 0"), null);
  assert.equal(parseBillQuery("123456"), null);
});

test("number-prefix ranges stay within five digits and become a PostgREST filter", () => {
  assert.deepEqual(numberPrefixRanges(15), [[150, 159], [1500, 1599], [15000, 15999]]);
  assert.deepEqual(numberPrefixRanges(1234), [[12340, 12349]]);
  assert.deepEqual(numberPrefixRanges(12345), []);
  assert.equal(rangesFilter([[150, 159], [1500, 1599]]), "and(number.gte.150,number.lte.159),and(number.gte.1500,number.lte.1599)");
  assert.deepEqual(congressesSince118(120), [120, 119, 118]);
});

test("prefix tsquery keeps only letters and digits, drops filler, and needs 4 letters for :*", () => {
  assert.equal(prefixTsquery("farm secu"), "farm & secu:*");
  assert.equal(prefixTsquery("Farm Bill"), "farm:*");
  assert.equal(prefixTsquery("act"), null);
  assert.equal(prefixTsquery("ab"), null);
  assert.equal(prefixTsquery("tax"), "tax");
  assert.equal(prefixTsquery("child tax cr"), "child & tax");
  // Operators and quotes typed by a visitor never reach to_tsquery.
  assert.equal(prefixTsquery("health') | !(x:* & care"), "health & care:*");
  assert.equal(prefixTsquery("!!! &&& :*"), null);
  // Second try with a shorter unfinished word (the stemmer would miss "securi").
  assert.equal(prefixTsquery("border securi", { trim: 2 }), "border & secu:*");
  assert.equal(prefixTsquery("farm", { trim: 2 }), "farm:*");
});

const DIR = [
  { bioguide_id: "S000033", name: "Bernard Sanders", last_name: "Sanders", nickname: "Bernie", serving: true },
  { bioguide_id: "S001234", name: "Linda T. Sánchez", last_name: "Sánchez", serving: true },
  { bioguide_id: "X1", name: "Former Sanderson", last_name: "Sanderson", serving: false },
  { bioguide_id: "O000172", name: "Alexandria Ocasio-Cortez", last_name: "Ocasio-Cortez", serving: true },
  { bioguide_id: "A1", name: "Sandy Adams", last_name: "Adams", serving: true },
];

test("members match any word prefix, ignore accents, and list serving members first", () => {
  assert.deepEqual(matchMembers(DIR, "sanchez").map((m) => m.bioguide_id), ["S001234"]);
  assert.deepEqual(matchMembers(DIR, "bern").map((m) => m.bioguide_id), ["S000033"]);
  assert.deepEqual(matchMembers(DIR, "cortez").map((m) => m.bioguide_id), ["O000172"]);
  assert.deepEqual(matchMembers(DIR, "ocasiocor").map((m) => m.bioguide_id), ["O000172"]);
  // Serving first; then a last-name hit before a first-name hit; former members last.
  assert.deepEqual(matchMembers(DIR, "sand").map((m) => m.bioguide_id), ["S000033", "A1", "X1"]);
  // Every word must match: "bernard sanders" yes, "bernard adams" no.
  assert.equal(matchMembers(DIR, "bernard sa").length, 1);
  assert.equal(matchMembers(DIR, "bernard adams").length, 0);
  assert.equal(matchMembers(DIR, "s").length, 0);
});

test("pages, topics and committees match by word prefix, first-word hits first", () => {
  const pages = ["Federal budget", "Glossary", "First time voting?", "Budget basics"];
  assert.deepEqual(matchByWords(pages, "bud", (x) => x), ["Budget basics", "Federal budget"]);
  assert.deepEqual(matchByWords(pages, "fir vot", (x) => x), ["First time voting?"]);
  assert.deepEqual(matchByWords(pages, "zz", (x) => x), []);
});

test("rows are shared out one group at a time up to the cap", () => {
  const g = (key, n) => ({ key, items: Array.from({ length: n }, (_, i) => `${key}${i}`) });
  const out = pickRows([g("members", 6), g("bills", 5), g("committees", 0), g("pages", 1)], 8);
  assert.deepEqual(out.map((x) => [x.key, x.items.length]), [["members", 4], ["bills", 3], ["pages", 1]]);
  assert.equal(pickRows([g("a", 2)], 8)[0].items.length, 2);
});

test("highlighting bolds the typed start of each word, keeping accents as written", () => {
  assert.deepEqual(highlightParts("Linda T. Sánchez", "sanc"), [
    { text: "Linda T. ", match: false }, { text: "Sánc", match: true }, { text: "hez", match: false }]);
  assert.deepEqual(highlightParts("Farm Security Act", "farm sec"), [
    { text: "Farm", match: true }, { text: " ", match: false }, { text: "Sec", match: true }, { text: "urity Act", match: false }]);
  assert.deepEqual(highlightParts("Glossary", ""), [{ text: "Glossary", match: false }]);
  // Decomposed accents (e + combining acute) stay with their letter.
  const nfd = "José Diaz";
  assert.equal(highlightParts(nfd, "jose")[0].text, "José");
  assert.equal(fold("Núñez"), "nunez");
});
