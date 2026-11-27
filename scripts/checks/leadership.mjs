// Leadership posts come from unitedstates/congress-legislators, which volunteers update by hand and
// can lag a change (e.g. a policy chair replaced mid-Congress). Weekly, confirm each person the site
// shows as a current House or Senate leader still appears on the chamber's own leadership page.
// The official pages aren't parsed into titles: a missing name is the signal to look.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../src/lib/config.js";
import { currentRoles } from "../../lib/leadership.js";

const PAGES = { house: "https://www.house.gov/leadership", senate: "https://www.senate.gov/senators/leadership.htm" };
const UA = { "User-Agent": "civic-atlas accuracy check (github.com/christofogis/civic-atlas)" };
const today = new Date().toISOString().slice(0, 10);

const res = await fetch(`${SUPABASE_URL}/rest/v1/leadership_roles?select=bioguide_id,chamber,title,start_date,end_date,members(first_name,last_name)`, {
  headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}` },
});
if (!res.ok) { console.log(`Database returned ${res.status}`); process.exit(1); }
const roles = currentRoles(await res.json(), today);

const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
let problems = 0;
for (const [chamber, url] of Object.entries(PAGES)) {
  const page = await fetch(url, { headers: UA });
  if (!page.ok) { console.log(`${url} returned ${page.status}; skipped`); continue; }
  const text = strip((await page.text()).replace(/<[^>]+>/g, " "));
  const mine = roles.filter((r) => r.chamber === chamber);
  // After Jan 3 of a new Congress, the previous Congress's posts no longer count as current; an
  // empty list means the source hasn't recorded the new Congress's leaders yet.
  if (!mine.length) { console.log(`${chamber}: no current leadership posts on record (new Congress not yet in the source?).`); problems++; continue; }
  const missing = mine.filter((r) => !text.includes(strip(r.members.last_name)));
  for (const r of missing) console.log(`Not on ${url}: ${r.members.first_name} ${r.members.last_name}, "${r.title}" since ${r.start_date}.`);
  console.log(`${chamber}: ${mine.length - missing.length} of ${mine.length} current leaders found on the official page.`);
  problems += missing.length;
}
if (problems) { console.log("The source dataset may be behind; see https://github.com/unitedstates/congress-legislators."); process.exit(1); }
