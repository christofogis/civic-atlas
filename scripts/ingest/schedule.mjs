// What Congress has scheduled: House floor items (this week and next), committee hearings and
// markups in both chambers, and when the Senate next convenes. From the official feeds:
//   docs.house.gov/floor (weekly XML), docs.house.gov committee RSS + meeting XML,
//   senate.gov hearings.xml and floor_schedule.xml.
//   node scripts/ingest/schedule.mjs [--dry-run]
import { XMLParser } from "fast-xml-parser";
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { parseHouseFloor, parseSenateHearings, parseSenateConvene, parseHouseMeeting } from "../../lib/schedule.js";

const DRY = process.argv.includes("--dry-run");
const UA = { headers: { "User-Agent": "civic-atlas (github.com/christofogis/civic-atlas)" } };
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEEP_DAYS = 30;

async function getXml(url) {
  await sleep(250);
  const res = await fetch(url, UA);
  if (!res.ok) return null;
  const body = await res.text();
  if (!body.trimStart().startsWith("<?xml") && !/^<(floorschedule|committee-meeting|rss|css_meetings|CongressSession)/.test(body.trimStart())) return null;
  return parser.parse(body);
}

const eastern = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
function mondays() {
  const today = new Date(`${eastern(new Date())}T12:00:00Z`);
  const mon = new Date(today);
  mon.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const next = new Date(mon);
  next.setUTCDate(mon.getUTCDate() + 7);
  return [mon, next].map((d) => d.toISOString().slice(0, 10).replace(/-/g, ""));
}

async function collect(db) {
  const events = [];
  const today = eastern(new Date());

  for (const wk of mondays()) {
    const url = `https://docs.house.gov/floor/Download.aspx?file=/billsthisweek/${wk}/${wk}.xml`;
    const doc = await getXml(url);
    const items = doc ? parseHouseFloor(doc, `https://docs.house.gov/floor/Default.aspx?date=${wk.slice(0, 4)}-${wk.slice(4, 6)}-${wk.slice(6)}`) : [];
    console.log(`House floor week of ${wk}: ${doc ? `${items.length} items` : "not published"}`);
    events.push(...items);
  }

  const hearings = await getXml("https://www.senate.gov/general/committee_schedules/hearings.xml");
  const senate = hearings ? parseSenateHearings(hearings) : [];
  console.log(`Senate committee meetings: ${senate.length}`);
  events.push(...senate);

  const floor = await getXml("https://www.senate.gov/legislative/schedule/floor_schedule.xml");
  const convene = floor && parseSenateConvene(floor);
  if (convene && convene.event_date >= today) events.push(convene);
  console.log(`Senate next convenes: ${convene ? `${convene.event_date} ${convene.event_time}` : "unknown"}`);

  // House committees: each full committee's RSS lists its recent and upcoming meetings.
  const committees = db
    ? (await fetchAll(db, "committees", "committee_id,chamber,parent_id")).filter((c) => c.chamber === "house" && !c.parent_id)
    : [{ committee_id: "HSWM" }, { committee_id: "HSJU" }];
  let house = 0;
  for (const c of committees) {
    const code = `${c.committee_id.slice(2)}00`;
    const rss = await getXml(`https://docs.house.gov/Committee/RSS.ashx?Code=${code}`);
    for (const item of [rss?.rss?.channel?.item ?? []].flat()) {
      // Only meetings from today on: the RSS description carries the date.
      const when = String(item.description ?? "").match(/Meeting Date:\s*\w+,\s*([A-Za-z]+ \d{1,2}, \d{4})/)?.[1];
      if (!when || eastern(new Date(`${when} 12:00`)) < today) continue;
      const xmlUrl = item.enclosure?.["@_url"];
      if (!xmlUrl) continue;
      const meeting = await getXml(xmlUrl.replace(/^http:/, "https:"));
      const ev = meeting && parseHouseMeeting(meeting, String(item.link ?? xmlUrl).replace(/^http:/, "https:"));
      if (ev?.event_date) { events.push(ev); house++; }
    }
  }
  console.log(`House committee meetings ahead: ${house}`);
  return events;
}

async function run(db) {
  const events = await collect(db);
  // The same event can appear twice (e.g. a meeting listed by two committees); keep one.
  const unique = [...new Map(events.map((e) => [e.event_id, e])).values()];
  if (DRY) {
    for (const e of unique.slice(0, 12)) console.log(JSON.stringify(e));
    console.log(`dry run: ${unique.length} events, nothing written`);
    return { rows_inserted: 0, rows_updated: 0, rows_deleted: 0 };
  }
  const known = new Set((await fetchAll(db, "committees", "committee_id")).map((c) => c.committee_id));
  for (const e of unique) if (e.committee_id && !known.has(e.committee_id)) e.committee_id = null;
  await upsertBatches(db, "upcoming_events", unique, "event_id");

  // Items dropped from the House floor schedule for a week we just read are removed too.
  const weeks = mondays().map((w) => `${w.slice(0, 4)}-${w.slice(4, 6)}-${w.slice(6)}`);
  const floorIds = new Set(unique.filter((e) => e.kind === "floor").map((e) => e.event_id));
  const { data: stored } = await db.from("upcoming_events").select("event_id").eq("kind", "floor").in("event_date", weeks);
  const dropped = (stored ?? []).map((r) => r.event_id).filter((id) => !floorIds.has(id));
  if (dropped.length && unique.some((e) => e.kind === "floor")) {
    await db.from("upcoming_events").delete().in("event_id", dropped);
  }
  const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  const { data: old } = await db.from("upcoming_events").delete().lt("event_date", cutoff).select("event_id");
  console.log(`saved ${unique.length} events; removed ${dropped.length} dropped floor items and ${old?.length ?? 0} older than ${KEEP_DAYS} days`);
  return { rows_inserted: 0, rows_updated: unique.length, rows_deleted: dropped.length + (old?.length ?? 0) };
}

if (DRY) await run(null);
else { const db = getClient(); await withRun(db, "schedule", () => run(db)); }
