import test from "node:test";
import assert from "node:assert/strict";
import { memberCard, billCard, committeeCard, statePersonCard, ballotCard, cardPath, partyBadge } from "../lib/ogCard.js";
import { withDrawnCard } from "../lib/seoPage.js";
import { memberMeta } from "../lib/pageMeta.js";
import { getLang } from "../src/lib/lang.js";

const today = "2026-11-28";
const rep = (party) => ({ bioguide_id: "K000397", name: "Pat Doe", chamber: "house", state: "CA", district: 40, party, start_date: "2025-01-03", end_date: "2027-01-03" });

test("card paths are fixed and safe", () => {
  assert.equal(cardPath("member", "P000145"), "/og/member/P000145.png");
  assert.equal(cardPath("bill", "119-hr-1"), "/og/bill/119-hr-1.png");
  assert.equal(cardPath("state", "../x"), "/og/state/x.png");
});

test("same card layout and wording for every party; the letter is always there", () => {
  const d = memberCard(rep("Democrat"), { today }), r = memberCard(rep("Republican"), { today }), i = memberCard(rep("Independent"), { today });
  assert.deepEqual([d.party.letter, d.party.kind, r.party.letter, r.party.kind, i.party.letter, i.party.kind], ["D", "d", "R", "r", "I", "other"]);
  assert.deepEqual(d.lines, r.lines);
  assert.equal(d.kicker, r.kicker);
  assert.equal(d.portrait, "https://unitedstates.github.io/images/congress/450x550/K000397.jpg");
  assert.equal(memberCard(rep("Democrat"), { today, portrait: false }).portrait, null);
  assert.equal(partyBadge("Democratic-Farmer-Labor").letter, "D");
  assert.equal(partyBadge(null), null);
});

test("member card: former member says until when", () => {
  assert.deepEqual(memberCard({ ...rep("Republican"), end_date: "2024-11-13" }, { today }).lines.map((l) => l.en), ["U.S. Representative, California District 40", "Served until Nov 13, 2024"]);
});

test("bill card: number, Congress, title, status line, law number", () => {
  const c = billCard({ congress: 119, bill_type: "hr", number: 1, title: "An Act", short_title: "One Big Beautiful Bill Act", introduced_date: "2025-05-20",
    passed_house_date: "2025-05-22", passed_senate_date: "2025-07-01", presented_date: "2025-07-03", became_law_date: "2025-07-04", law_number: "119-21" }, { today });
  assert.equal(c.kicker, "H.R. 1 · 119th Congress");
  assert.equal(c.title, "One Big Beautiful Bill Act");
  assert.deepEqual(c.lines.map((l) => l.en), ["Became law, Jul 4, 2025", "Public Law 119-21"]);
  assert.equal(c.path, "/og/bill/119-hr-1.png");
  const passed = billCard({ congress: 119, bill_type: "s", number: 5, title: "A bill", introduced_date: "2025-01-05", passed_senate_date: "2025-03-01" }, { today });
  assert.deepEqual(passed.lines.map((l) => l.en), ["Passed Senate, Mar 1, 2025"]);
  assert.equal(passed.party, null);
});

test("committee, state official (no photo) and On the ballot cards", () => {
  assert.equal(committeeCard({ committee_id: "HSAG15", chamber: "house", name: "Subcommittee on Forestry", parent: { name: "Committee on Agriculture" } }).lines[0].en, "Subcommittee of the House Committee on Agriculture");
  const s = statePersonCard({ id: "ocd-person/0a1b2c3d-0000-4000-8000-123456789abc", name: "Pat Doe", state: "CA", party: "Republican", active: true, state_roles: [{ type: "upper", district: "36" }] }, { today });
  assert.equal(s.portrait, null);
  assert.equal(s.path, "/og/state/0a1b2c3d-0000-4000-8000-123456789abc.png");
  assert.equal(s.lines[0].en, "California State Senate, District 36");
  assert.match(s.alt.es, /^Tarjeta de Civic Atlas: .*partido R \(Republicano\)$/);
  assert.equal(ballotCard(2028).title, "On the ballot in 2028");
  assert.equal(getLang(), "en");
});

test("a card that wasn't drawn falls back to the previous image", async () => {
  const meta = memberMeta(rep("Democrat"), { url: new URL("https://x.dev/member/K000397"), today });
  const env = (type) => ({ ASSETS: { fetch: async () => new Response(null, { status: 200, headers: { "Content-Type": type } }) } });
  const url = new URL("https://x.dev/member/K000397");
  const drawn = await withDrawnCard(env("image/png"), url, meta);
  assert.equal(drawn.image, "https://x.dev/og/member/K000397.png");
  assert.equal(drawn.imageSize.width, 1200);
  const missing = await withDrawnCard(env("text/html; charset=utf-8"), url, meta);
  assert.equal(missing.image, "https://unitedstates.github.io/images/congress/450x550/K000397.jpg");
  assert.equal(missing.card, "summary");
  assert.equal(missing.imageSize, undefined);
  const broken = await withDrawnCard({ ASSETS: { fetch: async () => { throw new Error("x"); } } }, url, meta);
  assert.equal(broken.card, "summary");
});

test("a card renders to a 1200x630 PNG", async () => {
  const { renderCard } = await import("../scripts/og/render.mjs");
  const png = await renderCard(ballotCard(2028));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});
