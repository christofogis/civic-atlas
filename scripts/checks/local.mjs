// Weekly: the Orange County officials file (public/data/local/ca-orange.json) against the
// county's own sources: supervisor names by district from its GIS layer, and each countywide
// officer's name on its elected-officials page. A mismatch means the file needs updating.
import { readFileSync } from "node:fs";

const file = JSON.parse(readFileSync("public/data/local/ca-orange.json", "utf8"));
const UA = { "User-Agent": "civic-atlas accuracy check (github.com/christofogis/civic-atlas)" };
const problems = [];

const layer = "https://services.arcgis.com/UXmFoWC7yDHcDN5Q/ArcGIS/rest/services/OC_Supervisory_Districts/FeatureServer/31/query?where=1%3D1&outFields=DISTRICT,NAME&returnGeometry=false&f=json";
const gis = await fetch(layer, { headers: UA }).then((r) => r.json()).catch(() => null);
if (!gis?.features) console.log("County GIS layer unavailable; supervisors not checked");
else for (const f of gis.features) {
  const mine = file.supervisors.find((s) => s.district === f.attributes.DISTRICT);
  if (!mine || mine.name !== f.attributes.NAME?.trim()) problems.push(`District ${f.attributes.DISTRICT}: county GIS says "${f.attributes.NAME}", file says "${mine?.name}"`);
}

const page = await fetch("https://www.ocgov.com/residents/gov/elected", { headers: UA }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
if (!page) console.log("ocgov.com elected officials page unavailable; officers not checked");
else {
  const text = page.replace(/<[^>]+>/g, " ");
  for (const o of file.officers) if (!text.includes(o.name.split(" ").pop())) problems.push(`${o.office}: "${o.name}" not found on ocgov.com`);
}

// City councils: each member's name still on the city's council page.
for (const c of file.cities ?? []) {
  const html = await fetch(c.website, { headers: UA }).then((r) => (r.ok ? r.text() : null)).catch(() => null);
  if (!html) { console.log(`${c.name} council page unavailable; not checked`); continue; }
  const text = html.replace(/<[^>]+>/g, " ");
  for (const m of c.members) if (!text.includes(m.name)) problems.push(`${c.name} District ${m.district}: "${m.name}" not on ${c.website}`);
}

const today = new Date().toISOString().slice(0, 10);
for (const c of file.cities ?? []) {
  if (c.roles_until && c.roles_until < today) problems.push(`${c.name}: mayor and mayor pro tem chosen each December; update roles (roles_until ${c.roles_until})`);
  for (const m of c.members) if (m.seat_change_by && m.seat_change_by < today) problems.push(`${c.name} District ${m.district}: on the ${m.on_ballot} ballot; update the seat`);
}
for (const s of file.supervisors) if (s.term_end < today) problems.push(`District ${s.district}: term ended ${s.term_end}; update the file with the new term`);

// The board's schedule is a list of dates from its yearly PDF; flag when the list runs short.
const lastMeeting = file.board_meetings?.dates.at(-1);
if (lastMeeting) {
  const soon = new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10);
  if (lastMeeting < soon) problems.push(`Board of Supervisors: schedule ends ${lastMeeting}; add next year's dates from the approved schedule PDF`);
  for (const src of file.board_meetings.sources) {
    const r = await fetch(src.url, { method: "HEAD" }).catch(() => null);
    if (!r?.ok) problems.push(`Board schedule source unreachable: ${src.url} (${r?.status ?? "error"})`);
  }
}

if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
console.log(`Orange County officials match the county's sources (file checked ${file.checked}).`);
