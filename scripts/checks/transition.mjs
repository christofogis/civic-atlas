// Rehearses the next Congress transition (Jan 3 of an odd year) against the live site: address
// lookups as of the day before and the day itself, through /api/lookup's as_of parameter (only
// honored with LOOKUP_CHECK_TOKEN). Checks the district switch and that no one whose term has
// ended is shown as serving. Prints each address's district under both Congresses.
//   LOOKUP_CHECK_TOKEN=... node scripts/checks/transition.mjs https://civic-atlas-cub.pages.dev
import { congressOn } from "../../lib/congress.js";

const base = process.argv[2] ?? "https://civic-atlas-cub.pages.dev";
const token = process.env.LOOKUP_CHECK_TOKEN;
if (!token) { console.log("LOOKUP_CHECK_TOKEN not set; skipping transition rehearsal"); process.exit(0); }

const now = new Date();
const y = now.getUTCFullYear();
const nextYear = y % 2 === 1 && (now.getUTCMonth() > 0 || now.getUTCDate() >= 3) ? y + 2 : y % 2 === 1 ? y : y + 1;
const DAY = `${nextYear}-01-03`, EVE = `${nextYear}-01-02`;
const NEXT = congressOn(DAY);

// Addresses in states with new lines next Congress (CA, TX), and without (NY, MO).
const CASES = [
  ["Los Alamitos City Hall, CA", "3191 Katella Ave, Los Alamitos, CA 90720"],
  ["Texas Capitol", "1100 Congress Ave, Austin, TX 78701"],
  ["New York State Capitol", "State St and Washington Ave, Albany, NY 12224"],
  ["Missouri State Capitol", "201 W Capitol Ave, Jefferson City, MO 65101"],
];

let failed = 0;
const lookup = async (address, asOf) => {
  const r = await fetch(`${base}/api/lookup?address=${encodeURIComponent(address)}&as_of=${asOf}`, { headers: { "X-Check-Token": token } });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
};
console.log(`Rehearsing ${DAY} (${NEXT}th Congress begins)`);
for (const [label, address] of CASES) {
  const [eve, day] = [await lookup(address, EVE), await lookup(address, DAY)];
  const problems = [];
  if (!eve.ok) problems.push(`${EVE}: HTTP ${eve.status} ${eve.body.error ?? ""}`);
  if (!day.ok) problems.push(`${DAY}: HTTP ${day.status} ${day.body.error ?? ""}`);
  if (eve.ok && day.ok) {
    if (eve.body.congress !== NEXT - 1) problems.push(`${EVE}: districts for Congress ${eve.body.congress}, expected ${NEXT - 1}`);
    if (day.body.congress !== NEXT) problems.push(`${DAY}: districts for Congress ${day.body.congress}, expected ${NEXT}`);
    for (const [when, r] of [[EVE, eve], [DAY, day]]) {
      for (const o of r.body.officials ?? []) {
        if (o.seat_status === "serving" && o.end_date && o.end_date <= when) problems.push(`${when}: ${o.name} shown serving after term ended ${o.end_date}`);
      }
    }
    const house = (r) => (r.body.officials ?? []).filter((o) => o.chamber === "house")
      .map((o) => `${o.state}-${o.district} ${o.seat_status === "serving" ? o.name : "(new term began; updating)"}`).join("; ") || "none";
    const senate = (r) => (r.body.officials ?? []).filter((o) => o.chamber === "senate").map((o) => (o.seat_status === "serving" ? o.name : "(updating)")).join(", ");
    console.log(`${problems.length ? "FAIL" : "ok  "} ${label}\n       ${EVE}: districts ${eve.body.districts?.join(",")} · House ${house(eve)} · Senate ${senate(eve)}\n       ${DAY}: districts ${day.body.districts?.join(",")} · House ${house(day)} · Senate ${senate(day)}`);
  }
  if (problems.length) { failed++; console.log(`       ${problems.join("\n       ")}`); }
}
if (failed) { console.log(`${failed} transition check(s) failed`); process.exit(1); }
