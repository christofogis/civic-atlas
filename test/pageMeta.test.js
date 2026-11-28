import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { matchPage, memberMeta, billMeta, committeeMeta, statePersonMeta, ballotMeta, headTags, rewriteHandlers, SHELL_TAGS } from "../lib/pageMeta.js";
import { getLang } from "../src/lib/lang.js";

const url = (p) => new URL(p, "https://civic-atlas-cub.pages.dev");
const today = "2026-11-26";

test("matchPage: only record pages, with valid ids", () => {
  assert.deepEqual(matchPage("/member/P000145"), { kind: "member", id: "P000145" });
  assert.equal(matchPage("/member/P000145/votes"), null);
  assert.equal(matchPage("/member/p000145"), null);
  assert.deepEqual(matchPage("/bill/119/hr/1"), { kind: "bill", congress: 119, type: "hr", number: 1 });
  assert.equal(matchPage("/bill/119/xx/1"), null);
  assert.deepEqual(matchPage("/committee/hsag15"), { kind: "committee", id: "HSAG15" });
  assert.deepEqual(matchPage("/state/person/0a1b2c3d-0000-4000-8000-123456789abc"), { kind: "statePerson", id: "0a1b2c3d-0000-4000-8000-123456789abc" });
  assert.equal(matchPage("/state/person/x'--"), null);
  assert.deepEqual(matchPage("/on-the-ballot"), { kind: "ballot" });
  assert.equal(matchPage("/members"), null);
});

const padilla = { bioguide_id: "P000145", name: "Alex Padilla", chamber: "senate", state: "CA", district: null, party: "Democrat", start_date: "2025-01-03", end_date: "2031-01-03" };

test("member: name, office, party letter, portrait", () => {
  const m = memberMeta(padilla, { url: url("/member/P000145?tab=votes"), today });
  assert.equal(m.title, "Alex Padilla · Civic Atlas");
  assert.equal(m.description, "Alex Padilla, U.S. Senator from California (D). Votes, bills, committees and campaign money from official records.");
  assert.equal(m.canonical, "https://civic-atlas-cub.pages.dev/member/P000145");
  // The member's own card, with the portrait as the fallback when the card wasn't drawn.
  assert.equal(m.image, "https://civic-atlas-cub.pages.dev/og/member/P000145.png");
  assert.equal(m.card, "summary_large_image");
  assert.equal(m.imageAlt, "Civic Atlas card: Member of Congress · Alex Padilla · U.S. Senator from California, party D (Democrat)");
  assert.equal(m.fallback.image, "https://unitedstates.github.io/images/congress/450x550/P000145.jpg");
  assert.equal(m.fallback.card, "summary");
});

test("member: House seat, former member, member-elect, same wording for every party", () => {
  const rep = { bioguide_id: "K000397", name: "Young Kim", chamber: "house", state: "CA", district: 40, party: "Republican", start_date: "2025-01-03", end_date: "2027-01-03" };
  assert.match(memberMeta(rep, { url: url("/"), today }).description, /^Young Kim, U\.S\. Representative, California District 40 \(R\)\. Votes/);
  const former = { ...rep, end_date: "2025-01-03" };
  assert.match(memberMeta(former, { url: url("/"), today }).description, /\(R\), until Jan 3, 2025\. /);
  const elect = { ...rep, start_date: "2027-01-03", end_date: "2029-01-03" };
  assert.match(memberMeta(elect, { url: url("/"), today }).description, /\(R\), from Jan 3, 2027\. /);
  const ind = { ...padilla, party: "Independent", state: "VT" };
  assert.match(memberMeta(ind, { url: url("/"), today }).description, /from Vermont \(I\)\./);
});

test("Spanish when the link asks for it, and the shared language is restored", () => {
  const m = memberMeta(padilla, { url: url("/member/P000145?lang=es"), lang: "es", today });
  assert.match(m.description, /^Alex Padilla, Senador\(a\) de EE\. UU\. por California \(D\)\. Votos/);
  assert.equal(m.canonical, "https://civic-atlas-cub.pages.dev/member/P000145?lang=es");
  assert.equal(m.locale, "es_US");
  assert.equal(getLang(), "en");
});

test("bill: number, short title, introduced, latest action", () => {
  const b = billMeta({ congress: 119, bill_type: "hr", number: 1, title: "An Act to provide for reconciliation", short_title: "One Big Beautiful Bill Act",
    introduced_date: "2025-05-20", latest_action_date: "2025-07-04", latest_action_text: "Became Public Law No: 119-21.", law_number: "119-21" }, { url: url("/bill/119/hr/1") });
  assert.equal(b.title, "H.R. 1: One Big Beautiful Bill Act · Civic Atlas");
  assert.equal(b.description, "Public Law 119-21 · Introduced May 20, 2025 · latest action (Jul 4, 2025): Became Public Law No: 119-21.");
  assert.equal(b.image, "https://civic-atlas-cub.pages.dev/og/bill/119-hr-1.png");
  assert.equal(b.fallback.image, "https://civic-atlas-cub.pages.dev/og/site.png");
  const long = billMeta({ congress: 118, bill_type: "s", number: 9, title: "x ".repeat(200), latest_action_text: "y ".repeat(400) }, { url: url("/") });
  assert.ok(long.ogTitle.length <= 120 && long.description.length <= 300 && long.description.endsWith("…"));
});

test("committee and subcommittee", () => {
  const c = committeeMeta({ committee_id: "HSAG", chamber: "house", name: "Committee on Agriculture", parent: null }, { url: url("/committee/HSAG") });
  assert.equal(c.title, "House Committee on Agriculture · Civic Atlas");
  const s = committeeMeta({ committee_id: "HSAG15", chamber: "house", name: "Subcommittee on Forestry", parent: { name: "Committee on Agriculture" } }, { url: url("/") });
  assert.match(s.description, /^A subcommittee of the House Committee on Agriculture\. /);
});

test("state official: current office, else state only", () => {
  const p = { id: "ocd-person/0a1b2c3d-0000-4000-8000-123456789abc", name: "Pat Doe", state: "CA", party: "Democratic", active: true,
    state_roles: [{ type: "upper", district: "36", start_date: "2024-12-02", end_date: null }, { type: "lower", district: "70", start_date: "2018-12-03", end_date: "2024-11-30" }] };
  const m = statePersonMeta(p, { url: url("/"), today });
  assert.equal(m.description, "Pat Doe, California State Senate, District 36 (D). Office, contact details and past roles from official state sources.");
  assert.equal(m.canonical, "https://civic-atlas-cub.pages.dev/state/person/0a1b2c3d-0000-4000-8000-123456789abc");
  assert.match(statePersonMeta({ ...p, active: false }, { url: url("/"), today }).description, /^Pat Doe, California \(D\)\./);
});

test("On the ballot: next election by default, a valid ?year= kept in the canonical URL", () => {
  assert.equal(ballotMeta({ url: url("/on-the-ballot?state=CA"), today }).title, "On the ballot in 2028 · Civic Atlas");
  assert.equal(ballotMeta({ url: url("/on-the-ballot?state=CA"), today }).canonical, "https://civic-atlas-cub.pages.dev/on-the-ballot");
  const y = ballotMeta({ url: url("/on-the-ballot?year=2026"), today });
  assert.equal(y.canonical, "https://civic-atlas-cub.pages.dev/on-the-ballot?year=2026");
  assert.match(y.description, /2026 general election \(Nov 3, 2026\)/);
  assert.equal(ballotMeta({ url: url("/on-the-ballot?year=1"), today }).ogTitle, "On the ballot in 2028");
});

test("head tags escape record text", () => {
  const html = headTags({ ...memberMeta(padilla, { url: url("/"), today }), ogTitle: `A "B" <C> & D` });
  assert.match(html, /content="A &quot;B&quot; &lt;C&gt; &amp; D"/);
  assert.doesNotMatch(html, /<C>/);
  for (const t of ["og:title", "og:description", "og:image", "og:url", "twitter:card"]) assert.match(html, new RegExp(t));
  assert.match(html, /<link rel="canonical" href="https:\/\/civic-atlas-cub\.pages\.dev\/member\/P000145" \/>/);
});

// A stand-in for HTMLRewriter over index.html: finds each selector's elements and applies the handlers
// with the element API they use. Real HTMLRewriter selector support is covered by SHELL_TAGS staying simple.
test("rewrite handlers replace the shell's generic tags in index.html", () => {
  let html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const meta = memberMeta(padilla, { url: url("/member/P000145"), today });
  const handlers = Object.fromEntries(rewriteHandlers(meta));
  const shellTag = /<(meta|link)\b[^>]*\/>\n?\s*/g;
  const isShell = (tag) => /name="description"|property="og:(?!site_name)|name="twitter:|rel="canonical"/.test(tag);
  html = html.replace(shellTag, (tag) => { let gone = false; if (isShell(tag)) handlers[SHELL_TAGS].element({ remove: () => { gone = true; } }); return gone ? "" : tag; });
  html = html.replace(/<title>[^<]*<\/title>/, () => { let out; handlers.title.element({ setInnerContent: (t) => { out = t; } }); return `<title>${out}</title>`; });
  html = html.replace("</head>", () => { let out = ""; handlers.head.element({ append: (h, o) => { assert.equal(o.html, true); out = h; } }); return `${out}</head>`; });
  assert.equal((html.match(/og:title/g) ?? []).length, 1);
  assert.equal((html.match(/name="description"/g) ?? []).length, 1);
  assert.match(html, /<title>Alex Padilla · Civic Atlas<\/title>/);
  assert.match(html, /property="og:site_name" content="Civic Atlas"/);
  assert.match(html, /og:image" content="https:\/\/civic-atlas-cub\.pages\.dev\/og\/member\/P000145\.png"/);
  assert.match(html, /og:image:type" content="image\/png"/);
  assert.match(html, /og:image:width" content="1200"/);
});
