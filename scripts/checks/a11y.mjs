// Accessibility check: runs axe-core on each page in scripts/checks/pages.mjs and fails on
// "serious" or "critical" problems (WCAG 2.2 A/AA rules). Run nightly after the site check. Every
// page is checked in light mode; a few key pages also in dark mode, since the two themes have
// different colors. (scripts/checks/a11y-audit.mjs is the full, on-demand version.)
//   node scripts/checks/a11y.mjs [base-url] [--report]   (--report lists everything, never fails)
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { PAGES } from "./pages.mjs";

const BASE = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "https://civic-atlas-cub.pages.dev";
const REPORT = process.argv.includes("--report");
const DARK = new Set(["/", "/member/P000145", "/bill/119/hr/1", "/week", "/local/ca-orange", "/?lang=es"]);
const browser = await chromium.launch();
const failures = [];
let broken = 0;   // pages the check couldn't run on; fails even in report mode
const runs = PAGES.flatMap(([path]) => [[path, 1280, "light"], [path, 390, "light"], ...(DARK.has(path) ? [[path, 390, "dark"]] : [])]);
for (const [path, width, theme] of runs) {
  {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });   // axe needs a context
    const page = await context.newPage();
    try {
      await page.goto(BASE + path, { waitUntil: /^\/(\?|$)/.test(path) ? "load" : "networkidle", timeout: 45_000 });
      await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 30_000 }).catch(() => {});
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .exclude("iframe")   // the Cloudflare bot check is not ours
        .analyze();
      for (const v of violations) {
        const where = v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ");
        const line = `${path} @${width}px${theme === "dark" ? " dark" : ""} [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length}x) ${where}`;
        if (REPORT || ["serious", "critical"].includes(v.impact)) failures.push(line);
      }
      console.log(`${path} @${width}px${theme === "dark" ? " dark" : ""}: ${violations.length} rule(s) flagged`);
    } catch (err) {
      broken++;
      failures.push(`${path} @${width}px${theme === "dark" ? " dark" : ""}: check didn't run: ${err.message.split("\n")[0]}`);
    }
    await context.close();
  }
}
await browser.close();
const unique = [...new Set(failures)];
console.log(unique.length ? `\n${unique.join("\n")}` : "\nNo serious accessibility problems found.");
if (broken || (unique.length && !REPORT)) process.exit(1);
