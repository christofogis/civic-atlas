// Address lookups against the live site, for public buildings in states with different district
// naming. Checks the shape of the answer (two senators, one House member, state legislators, a
// governor), not names, so it keeps passing as officeholders change.
//   LOOKUP_CHECK_TOKEN=... node scripts/checks/lookup.mjs https://civic-atlas-cub.pages.dev
const base = process.argv[2] ?? "https://civic-atlas-cub.pages.dev";
const token = process.env.LOOKUP_CHECK_TOKEN;
if (!token) { console.log("LOOKUP_CHECK_TOKEN not set; skipping address lookups"); process.exit(0); }

const CASES = [
  ["California State Capitol", "1315 10th St, Sacramento, CA 95814", { upper: 1, lower: 1 }],
  ["Massachusetts State House", "24 Beacon St, Boston, MA 02133", { upper: 1, lower: 1 }],
  ["New Hampshire State House", "107 N Main St, Concord, NH 03301", { upper: 1, lower: 1 }],
  ["Vermont State House", "115 State St, Montpelier, VT 05633", { upper: 1, lower: 1 }],
  ["Nebraska State Capitol", "1445 K St, Lincoln, NE 68508", { legislature: 1 }],
  ["Orange County Hall of Administration", "400 W Civic Center Dr, Santa Ana, CA 92701", { upper: 1, lower: 1 }, { supervisor: 2, city: "santa-ana" }],
  ["Rossmoor (unincorporated)", "3001 Blume Dr, Rossmoor, CA 90720", { upper: 1, lower: 1 }, { supervisor: 1, unincorporated: "Rossmoor" }],
  ["Anaheim City Hall", "200 S Anaheim Blvd, Anaheim, CA 92805", { upper: 1, lower: 1 }, { city: "anaheim" }],
  ["Los Alamitos City Hall", "3191 Katella Ave, Los Alamitos, CA 90720", { upper: 1, lower: 1 }, { supervisor: 1, city: "los-alamitos" }],
];

let failed = 0;
for (const [label, address, want, local] of CASES) {
  const res = await fetch(`${base}/api/lookup?address=${encodeURIComponent(address)}`, { headers: { "X-Check-Token": token } });
  const body = await res.json().catch(() => ({}));
  const problems = [];
  if (!res.ok) problems.push(`HTTP ${res.status}: ${body.error ?? ""}`);
  else {
    const fed = body.officials ?? [], st = body.state_officials ?? [];
    if (fed.filter((o) => o.chamber === "senate").length !== 2) problems.push("expected 2 U.S. senators");
    if (fed.filter((o) => o.chamber === "house").length < 1) problems.push("expected a U.S. House member");
    if (!st.some((o) => o.type === "governor")) problems.push("no governor");
    for (const [type, n] of Object.entries(want)) {
      if (st.filter((o) => o.type === type).length < n) problems.push(`no state ${type} member (districts ${JSON.stringify(body.state_districts)})`);
    }
    if (local?.supervisor && body.local?.supervisor_district !== local.supervisor) problems.push(`expected supervisor district ${local.supervisor}, got ${JSON.stringify(body.local)}`);
    if (local?.city && (body.local?.city?.id !== local.city || !body.local.city.council_district)) problems.push(`expected ${local.city} with a council district, got ${JSON.stringify(body.local?.city)}`);
    if (local?.unincorporated && (body.local?.place?.type !== "unincorporated" || body.local.place.name !== local.unincorporated)) problems.push(`expected unincorporated ${local.unincorporated}, got ${JSON.stringify(body.local?.place)}`);
    if (local && !local.city && body.local?.city) problems.push(`unexpected city ${JSON.stringify(body.local.city)}`);
    if (!local && body.local?.covered) problems.push("local officials shown outside Orange County");
    const names = st.filter((o) => ["upper", "lower", "legislature"].includes(o.type)).map((o) => `${o.type} ${o.district}: ${o.name}`);
    console.log(`${problems.length ? "FAIL" : "ok  "} ${label} — ${names.join("; ") || "no legislators"}`);
  }
  if (problems.length) { failed++; console.log(`     ${label}: ${problems.join(", ")}`); }
}
if (failed) { console.log(`${failed} lookup check(s) failed`); process.exit(1); }
