// Opens key pages of the live site in a real browser and checks each shows what it should.
// Run nightly by .github/workflows/site-check.yml; a failure opens a GitHub issue.
//   node scripts/checks/site.mjs [base-url]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://civic-atlas-cub.pages.dev";
const PAGES = [
  ["/", ["Civic Atlas", "Look up"]],
  ["/member/P000145", ["Alex Padilla", "At a glance", "Contact", "Voting record"]],
  ["/member/P000145/votes", ["Roll-call votes", "Issue"]],
  ["/bill/119/hr/1", ["Became law", "Cosponsors", "Roll-call votes", "Lobbying reports naming this bill"]],
  ["/bills", ["Bills", "Latest action"]],
  ["/members", ["Members of Congress", "California"]],
  ["/committees", ["Committees", "Senate"]],
  ["/committee/SSFI", ["Members", "Bills referred"]],
  ["/week", ["This week in Congress", "Coming up", "Committee hearings and markups"]],
  ["/search?q=padilla", ["Alex Padilla"]],
  ["/compare?a=P000145&b=S000033", ["Votes where they differed"]],
  ["/glossary", ["Cloture"]],
  ["/methods", ["Votes by issue"]],
];
const FAILURE_TEXT = /Couldn't load|isn't working right now|not found/i;

const browser = await chromium.launch();
const failures = [];
for (const [path, expected] of PAGES) {
  const page = await browser.newPage();
  const errors = [];
  const badRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", async (r) => {
    if (r.status() >= 400 && !r.url().includes("challenges.cloudflare.com")) {
      badRequests.push(`${r.status()} ${decodeURIComponent(r.url()).slice(0, 220)} ${(await r.text().catch(() => "")).slice(0, 200)}`);
    }
  });
  try {
    // The bot check on the home page keeps polling, so "network idle" never comes there.
    await page.goto(BASE + path, { waitUntil: path === "/" ? "load" : "networkidle", timeout: 45_000 });
    await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 30_000 }).catch(() => {});
    const text = await page.innerText("body");
    const missing = expected.filter((t) => !text.includes(t));
    if (missing.length) failures.push(`${path}: missing ${missing.map((m) => `"${m}"`).join(", ")}`);
    if (FAILURE_TEXT.test(text)) failures.push(`${path}: shows an error message`);
    if (errors.length) failures.push(`${path}: script error: ${errors[0].slice(0, 200)}`);
    for (const b of badRequests) failures.push(`${path}: request failed: ${b}`);
    console.log(`${missing.length || errors.length ? "FAIL" : "ok  "} ${path}`);
  } catch (err) {
    failures.push(`${path}: ${err.message.split("\n")[0]}`);
    console.log(`FAIL ${path}`);
  }
  await page.close();
}
await browser.close();
if (failures.length) {
  console.log(`\n${failures.length} problem(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nall pages ok");
