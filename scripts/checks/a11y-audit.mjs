// Full accessibility audit (on demand): axe-core on every route, in light and dark, on a phone
// (390px) and a desktop (1280px) screen, against WCAG 2.2 A/AA. Lists every finding and never
// fails on findings (the nightly a11y.mjs is the gate); fails only if a page couldn't be checked.
//   node scripts/checks/a11y-audit.mjs [base-url] [--light-only] [--best-practice]
// CHROME_PATH=/usr/bin/google-chrome uses an installed Chrome instead of Playwright's own.
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
import { PAGES } from "./pages.mjs";

const BASE = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "https://civic-atlas-cub.pages.dev";
const THEMES = process.argv.includes("--light-only") ? ["light"] : ["light", "dark"];
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", ...(process.argv.includes("--best-practice") ? ["best-practice"] : [])];

// Every route in src/main.jsx: the checked pages plus the routes they don't cover.
const EXTRA = ["/issues", "/elections", "/on-the-ballot", "/first-time-voter", "/map", "/style-test",
  "/committee/HSAG", "/topic/defense", "/no-such-page", "/first-time-voter?lang=es", "/on-the-ballot?lang=es", "/constitution", "/constitution?lang=es"];
const paths = [...new Set([...PAGES.map(([p]) => p.split("#")[0]), ...EXTRA])];

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const found = new Map();   // rule + target -> { line, where: Set }
let broken = 0;
for (const path of paths) {
  for (const theme of THEMES) {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await context.newPage();
      const tag = `${path} ${theme} @${width}px`;
      try {
        await page.goto(BASE + path, { waitUntil: /^\/(\?|$)/.test(path) ? "load" : "networkidle", timeout: 45_000 });
        await page.waitForFunction(() => !/Loading…|Cargando…/.test(document.body.innerText), null, { timeout: 20_000 }).catch(() => {});
        await page.waitForTimeout(500);
        const { violations } = await new AxeBuilder({ page }).withTags(TAGS).exclude("iframe").analyze();
        for (const v of violations) {
          for (const n of v.nodes) {
            const target = n.target.join(" ");
            const detail = v.id === "color-contrast" ? ` ${n.any[0]?.message?.match(/contrast of [\d.]+ \(foreground color: #\w+, background color: #\w+/)?.[0] ?? ""}` : "";
            const key = `${v.id}|${target}|${detail}`;
            if (!found.has(key)) found.set(key, { line: `[${v.impact}] ${v.id}: ${target}${detail}  -- ${n.html.slice(0, 140)}`, where: new Set() });
            found.get(key).where.add(tag);
          }
        }
        console.log(`${tag}: ${violations.length} rule(s)`);
      } catch (err) {
        broken++;
        console.log(`${tag}: check didn't run: ${err.message.split("\n")[0]}`);
      }
      await context.close();
    }
  }
}
await browser.close();
const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const rows = [...found.values()].sort((a, b) => order[a.line.slice(1, a.line.indexOf("]"))] - order[b.line.slice(1, b.line.indexOf("]"))]);
console.log(`\n${rows.length} distinct finding(s)`);
for (const r of rows) console.log(`${r.line}\n    on: ${[...r.where].slice(0, 6).join("; ")}${r.where.size > 6 ? ` (+${r.where.size - 6} more)` : ""}`);
if (broken) process.exit(1);
