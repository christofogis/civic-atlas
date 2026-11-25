// California statewide offices kept by hand (public/data/state/ca-statewide.json). Weekly, confirm
// each holder's name still appears on the office's own website, and flag when the new term has
// begun and the file still lists the previous holders.
import { readFileSync } from "node:fs";

const file = JSON.parse(readFileSync("public/data/state/ca-statewide.json", "utf8"));
const today = new Date().toISOString().slice(0, 10);
const problems = [];
if (file.seat_change_by && file.seat_change_by <= today) {
  problems.push(`New terms began ${file.seat_change_by}: update the holders from ${file.results_url}, then set the next seat_change_by.`);
}
for (const o of file.offices) {
  const res = await fetch(o.website, { headers: { "User-Agent": "civic-atlas accuracy check (github.com/christofogis/civic-atlas)" } }).catch(() => null);
  if (!res?.ok) { console.log(`${o.website}: ${res?.status ?? "no response"}; skipped`); continue; }
  const text = (await res.text()).replace(/<[^>]+>/g, " ");
  if (!text.includes(o.check_name)) problems.push(`${o.title[0]}: "${o.check_name}" not found on ${o.website}`);
  else console.log(`${o.title[0]}: ${o.name} found on ${o.website}`);
}
if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
