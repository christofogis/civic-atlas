// Opens key pages of the live site in a real browser and checks each shows what it should.
// Run nightly by .github/workflows/site-check.yml; a failure opens a GitHub issue.
//   node scripts/checks/site.mjs [base-url]
import { chromium } from "playwright";
import { PAGES } from "./pages.mjs";

const BASE = process.argv[2] ?? "https://civic-atlas-cub.pages.dev";
// Feeds fetched directly: [path, content-type fragment, text that must appear]
const FEEDS = [
  ["/api/feed/member/P000145", "rss", "<item>"],
  ["/api/feed/bill/119/hr/1", "rss", "Became law"],
  ["/api/calendar/committee/SSFI", "calendar", "BEGIN:VCALENDAR"],
  ["/api/calendar/member/P000145", "calendar", "END:VCALENDAR"],
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
for (const [path, type, must] of FEEDS) {
  try {
    const res = await fetch(BASE + path);
    const body = await res.text();
    const ok = res.ok && (res.headers.get("content-type") ?? "").includes(type) && body.includes(must);
    if (!ok) failures.push(`${path}: HTTP ${res.status}, ${res.headers.get("content-type")}, ${body.slice(0, 120)}`);
    console.log(`${ok ? "ok  " : "FAIL"} ${path}`);
  } catch (err) {
    failures.push(`${path}: ${err.message}`);
  }
}
if (failures.length) {
  console.log(`\n${failures.length} problem(s):\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log("\nall pages ok");
