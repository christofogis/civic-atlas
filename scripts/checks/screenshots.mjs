// Takes screenshots of live pages and prints them (base64 JPEG) into the job log, for design
// review where artifact downloads aren't available.
//   node scripts/checks/screenshots.mjs [base-url] [path,path,...] [width]
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "https://civic-atlas-cub.pages.dev";
const PATHS = (process.argv[3] ?? "/member/P000145").split(",");
const WIDTH = Number(process.argv[4] ?? 390);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 1 });
// A returning visitor: representatives remembered from an earlier lookup (California).
await page.goto(BASE);
await page.evaluate(() => localStorage.setItem("civic-atlas:my-reps", JSON.stringify(["P000145", "S001150"])));
for (const path of PATHS) {
  await page.goto(BASE + path, { waitUntil: path === "/" ? "load" : "networkidle" });
  await page.waitForTimeout(1500);
  const buf = await page.screenshot({ fullPage: true, type: "jpeg", quality: 55 });
  const b64 = buf.toString("base64");
  console.log(`SHOT-BEGIN ${path}`);
  for (let i = 0; i < b64.length; i += 8000) console.log(`SHOT ${b64.slice(i, i + 8000)}`);
  console.log(`SHOT-END ${path}`);
}
await browser.close();
