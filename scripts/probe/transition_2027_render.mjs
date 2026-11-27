// Renders key pages of a local build (vite preview) with the browser clock set to a future date,
// against the live database (read-only, publishable key), and prints what each page says.
// Run by scripts/probe/transition_2027.py in the probe workflow:
//   node scripts/probe/transition_2027_render.mjs http://localhost:4173
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:4173";
const JAN4 = "2027-01-04T17:00:00Z", DEC8 = "2026-12-08T20:00:00Z";
const DIXON = "/state/person/0c4e1b43-c3d7-4a13-87c4-92e29903cb73"; // CA Assembly 72
// [when, path, checks]: each check is [label, (text) => boolean].
const has = (s) => (t) => t.includes(s);
const lacks = (s) => (t) => !t.includes(s);
const PAGES = [
  [JAN4, "/leadership", [["no 119th Speaker shown as current", lacks("Speaker of the House")], ["says posts aren't in yet", has("aren't in the source data yet")]]],
  [JAN4, "/on-the-ballot", [["defaults to 2028", has("On the ballot in 2028")]]],
  [JAN4, "/on-the-ballot?year=2026", [["no outcome before data", lacks("Did not return")], ["says updating", has("being updated")]]],
  [JAN4, "/map?color=party", [["says no House member listed", has("No House member is listed as serving today")], ["current is 120th", has("120th Congress")]]],
  [JAN4, "/members", []],
  [JAN4, "/bills", [["120th empty state", has("No bills from the 120th Congress")]]],
  [JAN4, "/quiz", []],
  [JAN4, "/week", []],
  [JAN4, "/topics", []],
  [JAN4, "/committees", []],
  [JAN4, "/nominations", []],
  [JAN4, "/status", [["votes-120 row", has("Roll-call votes, 120th Congress")]]],
  [JAN4, "/member/M001241", [["term ended: not 'Current term'", lacks("Current term")]]],
  [JAN4, "/member/P000145", [["senator not up: still current", has("Current term")]]],
  [JAN4, "/member/H001104", [["appointee's term ended", lacks("Current term")]]],
  [JAN4, "/", []],
  [DEC8, DIXON, [["CA Assembly seat: new term notice", has("New term began")]]],
  ["2026-12-06T20:00:00Z", DIXON, [["before Dec 7: office shown", lacks("New term began")]]],
];

const browser = await chromium.launch();
let failed = 0;
for (const [when, path, checks] of PAGES) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("cloudflare")) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`); });
  await page.clock.setFixedTime(new Date(when));
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => errors.push(`goto: ${e.message}`));
  await page.waitForTimeout(1500);
  const text = (await page.locator("main").innerText().catch(() => "")).replace(/\s+\n/g, "\n");
  console.log(`\n===== ${when.slice(0, 10)} ${path}`);
  console.log(text.slice(0, 1800));
  for (const e of errors) console.log(`  error: ${e}`);
  for (const [label, ok] of checks) {
    const pass = ok(text);
    if (!pass) failed++;
    console.log(`  ${pass ? "PASS" : "FAIL"} ${label}`);
  }
  await context.close();
}
await browser.close();
console.log(`\n${failed ? `${failed} check(s) failed` : "all render checks passed"}`);
