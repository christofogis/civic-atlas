// Takes screenshots of live pages and prints them (base64 JPEG) into the job log, for design
// review where artifact downloads aren't available.
//   node scripts/checks/screenshots.mjs [base-url] [path,path,...] [width]
// A path "lookup:<address>" runs an address lookup on the home page and shoots the results. That
// needs LOOKUP_CHECK_TOKEN: the token goes on the lookup request, and the bot-check widget is
// replaced in this test browser only, since a headless browser can't complete it.
// "fresh:" before a path shoots it as a first-time visitor (nothing remembered).
// "at:YYYY-MM-DD|<path>" shoots it with the browser's clock set to that date (noon Eastern),
// to rehearse date-driven changes such as a new Congress.
// "dark:" before a path shoots it with the device set to dark mode (the System theme).
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://civic-atlas-cub.pages.dev";
const PATHS = (process.argv[3] ?? "/member/P000145").split(",");
const WIDTH = Number(process.argv[4] ?? 390);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 1 });
page.on("response", async (r) => { if (r.status() >= 400 && !r.url().includes("challenges.cloudflare.com")) console.log(`BAD ${r.status()} ${decodeURIComponent(r.url()).slice(0, 300)} ${(await r.text().catch(() => "")).slice(0, 300)}`); });
page.on("pageerror", (e) => console.log(`PAGEERROR ${e.message}`));
// A returning visitor: representatives remembered from an earlier lookup (California).
await page.goto(BASE);
await page.evaluate(() => localStorage.setItem("civic-atlas:my-reps", JSON.stringify(["P000145", "S001150"])));
const TOKEN = process.env.LOOKUP_CHECK_TOKEN;
if (TOKEN) {
  await page.route("**/api/lookup**", (route) => route.continue({ headers: { ...route.request().headers(), "x-check-token": TOKEN } }));
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript",
    body: "window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback('test'),50);return 1},reset:()=>{},remove:()=>{}};" }));
}
for (let path of PATHS) {
  const at = /^at:(\d{4}-\d{2}-\d{2})\|(.*)$/.exec(path);
  if (at) {
    await page.clock.setFixedTime(new Date(`${at[1]}T17:00:00Z`));
    path = at[2];
  }
  const dark = path.startsWith("dark:");
  if (dark) path = path.slice(5);
  const print = path.startsWith("print:");
  if (print) { path = path.slice(6); await page.emulateMedia({ media: "print", colorScheme: "light" }); }
  else await page.emulateMedia({ media: "screen", colorScheme: dark ? "dark" : "light" });
  if (path.startsWith("lookup:")) {
    if (!TOKEN) { console.log("LOOKUP_CHECK_TOKEN not set; skipping", path); continue; }
    await page.goto(BASE + "/", { waitUntil: "load" });
    await page.fill("#address", path.slice(7));
    await page.keyboard.press("Escape");
    await page.click("form.lookup button[type=submit]");
    await page.waitForSelector(".results", { timeout: 20000 }).catch(() => console.log("no results shown"));
    await page.waitForTimeout(2500);
  } else if (path.startsWith("fresh:")) {
    await page.evaluate(() => localStorage.removeItem("civic-atlas:my-reps"));
    await page.goto(BASE + path.slice(6), { waitUntil: "load" });
    await page.waitForTimeout(1500);
  } else {
    await page.goto(BASE + path.split(">>")[0], { waitUntil: /^\/(\?|$)/.test(path) ? "load" : "networkidle" });
    await page.waitForTimeout(1500);
  }
  await page.waitForFunction(() => !/Loading|Cargando/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => {});
  // "path>>selector": start the shot at that element (for sections far down a long page).
  const start = path.includes(">>") ? await page.locator(path.split(">>")[1]).first().boundingBox().catch(() => null) : null;
  // Very tall pages can't be captured whole; cap the height.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const buf = await page.screenshot({ fullPage: true, clip: start ? { x: 0, y: Math.max(0, start.y - 20), width: WIDTH, height: Math.min(2400, height - start.y + 20) } : height > 6000 ? { x: 0, y: 0, width: WIDTH, height: 6000 } : undefined, type: "jpeg", quality: 55 });
  const b64 = buf.toString("base64");
  console.log(`SHOT-BEGIN ${path}`);
  for (let i = 0; i < b64.length; i += 8000) console.log(`SHOT ${b64.slice(i, i + 8000)}`);
  console.log(`SHOT-END ${path}`);
}
await browser.close();
