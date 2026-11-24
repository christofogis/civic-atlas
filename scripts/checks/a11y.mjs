// Accessibility check: runs axe-core on each page in scripts/checks/pages.mjs and fails on
// "serious" or "critical" problems (WCAG 2.1 A/AA rules). Run nightly after the site check.
//   node scripts/checks/a11y.mjs [base-url] [--report]   (--report lists everything, never fails)
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { PAGES } from "./pages.mjs";

const BASE = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "https://civic-atlas-cub.pages.dev";
const REPORT = process.argv.includes("--report");
const browser = await chromium.launch();
const failures = [];
let broken = 0;   // pages the check couldn't run on; fails even in report mode
for (const [path] of PAGES) {
  for (const width of [1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });   // axe needs a context
    const page = await context.newPage();
    try {
      await page.goto(BASE + path, { waitUntil: /^\/(\?|$)/.test(path) ? "load" : "networkidle", timeout: 45_000 });
      await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 30_000 }).catch(() => {});
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude("iframe")   // the Cloudflare bot check is not ours
        .analyze();
      for (const v of violations) {
        const where = v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ");
        const line = `${path} @${width}px [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}x) ${where}`;
        if (REPORT || ["serious", "critical"].includes(v.impact)) failures.push(line);
      }
      console.log(`${path} @${width}px: ${violations.length} rule(s) flagged`);
    } catch (err) {
      broken++;
      failures.push(`${path} @${width}px: check didn't run: ${err.message.split("\n")[0]}`);
    }
    await context.close();
  }
}
await browser.close();
const unique = [...new Set(failures)];
console.log(unique.length ? `\n${unique.join("\n")}` : "\nNo serious accessibility problems found.");
if (broken || (unique.length && !REPORT)) process.exit(1);
