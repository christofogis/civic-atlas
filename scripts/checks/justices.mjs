// The Supreme Court list on /government is a small file (public/data/justices.json). Weekly,
// confirm each justice still appears on the Court's own "Current Members" page. A new justice
// almost always fills a departing one's seat, so a name that disappears is the signal.
import { readFileSync } from "node:fs";

const file = JSON.parse(readFileSync("public/data/justices.json", "utf8"));
const res = await fetch(file.source, { headers: { "User-Agent": "civic-atlas accuracy check (github.com/christofogis/civic-atlas)" } });
if (!res.ok) { console.log(`supremecourt.gov returned ${res.status}; skipped`); process.exit(0); }
const html = (await res.text()).replace(/<[^>]+>/g, " ");
const last = (n) => n.replace(/,? Jr\.?$/, "").trim().split(/\s+/).pop();
const missing = file.justices.filter((j) => !html.includes(last(j.name)));
if (missing.length) {
  console.log(`Not found on ${file.source}: ${missing.map((j) => j.name).join(", ")}. Update public/data/justices.json.`);
  process.exit(1);
}
console.log(`All ${file.justices.length} justices found on supremecourt.gov (file checked ${file.checked}).`);
