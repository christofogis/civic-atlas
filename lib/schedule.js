// Parsers for the official schedule feeds. Pure functions over already-parsed XML (from
// fast-xml-parser with attributes kept under "@_"), so they can be tested without the network.
import { extractBillRefs } from "./billrefs.js";

const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const text = (v) => (v == null ? null : String(typeof v === "object" ? v["#text"] ?? "" : v).replace(/\s+/g, " ").trim() || null);
const refs = (congress, s) => extractBillRefs(s).map((r) => `${congress}-${r.bill_type}-${r.number}`);

// "SSCM00" -> "SSCM", "SSCM01" -> "SSCM01"; House feed codes lack the "HS" prefix: "WM00" -> "HSWM".
export function committeeIdFromCode(code, chamber) {
  const c = String(code ?? "").toUpperCase().trim();
  const full = chamber === "house" && /^[A-Z]{2}\d{2}$/.test(c) ? `HS${c}` : c;
  if (!/^[A-Z]{4}\d{2}$/.test(full)) return null;
  return full.endsWith("00") ? full.slice(0, 4) : full;
}

// docs.house.gov floor schedule ("bills this week").
export function parseHouseFloor(doc, url) {
  const fs = doc?.floorschedule;
  if (!fs) return [];
  const congress = Number(fs["@_congress-num"]);
  const week = String(fs["@_week-date"] ?? "").slice(0, 10);
  const out = [];
  for (const cat of list(fs.category)) {
    const type = String(cat["@_type"] ?? "");
    const category = /suspension/i.test(type) ? "suspension" : /rule/i.test(type) ? "rule" : "other";
    for (const item of list(cat["floor-items"]?.["floor-item"])) {
      if (text(item["@_remove-date"])) continue;   // taken off the schedule
      const num = text(item["legis-num"]) ?? "";
      const title = text(item["floor-text"]) ?? num;
      out.push({
        event_id: `house-floor-${week.replace(/-/g, "")}-${item["@_id"]}`,
        chamber: "house", kind: "floor", event_date: week, event_time: null, week_of: true,
        committee_id: null, committee_name: null,
        title: num ? `${num.trim()}: ${title}` : title,
        category, bill_refs: refs(congress, num), location: null, status: null, source_url: url,
      });
    }
  }
  return out;
}

// senate.gov committee hearings and meetings schedule.
export function parseSenateHearings(doc) {
  const out = [];
  for (const m of list(doc?.css_meetings_scheduled?.meeting)) {
    const id = text(m.identifier);
    const date = text(m.date_iso_8601);
    if (!id || !date) continue;   // "No committee hearings scheduled" placeholder
    const type = text(m.type) ?? "";
    const matter = text(m.matter) ?? "Committee meeting";
    const docs = list(m.Documents?.AssociatedDocument)
      .filter((d) => d["@_document_prefix"] && d["@_document_prefix"] !== "PN")
      .flatMap((d) => refs(d["@_congress"], `${d["@_document_prefix"]} ${d["@_document_num"]}`));
    out.push({
      event_id: `senate-meeting-${id}`,
      chamber: "senate",
      kind: /hearing/i.test(type) ? "hearing" : /business meeting|markup/i.test(type) ? "markup" : "meeting",
      event_date: date, event_time: text(m.time), week_of: false,
      committee_id: committeeIdFromCode(m.cmte_code, "senate"), committee_name: text(m.committee),
      title: matter, category: null,
      bill_refs: [...new Set([...docs])],
      location: text(m.room), status: /postpon|cancel/i.test(`${type} ${matter}`) ? "Postponed or canceled" : "Scheduled",
      source_url: "https://www.senate.gov/committees/hearings_meetings.htm",
    });
  }
  return out;
}

// When the Senate next convenes, from its floor schedule (the last session day's NextConveneDate).
export function parseSenateConvene(doc) {
  const days = list(doc?.CongressSessionDayConvenings?.LegislativeDay).flatMap((d) => list(d.SessionDay));
  const next = days.map((d) => text(d.NextConveneDate)).filter(Boolean).sort().at(-1);
  if (!next) return null;
  const local = next.slice(0, 16);   // 2026-11-30T15:00 (Eastern, as published)
  const [h, mi] = local.slice(11).split(":").map(Number);
  const time = `${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return {
    event_id: `senate-convene-${local.slice(0, 10)}`,
    chamber: "senate", kind: "convene", event_date: local.slice(0, 10), event_time: `${time} ET`, week_of: false,
    committee_id: null, committee_name: null, title: "Senate convenes", category: null, bill_refs: [],
    location: null, status: "Scheduled", source_url: "https://www.senate.gov/legislative/schedule/floor_schedule.htm",
  };
}

// One docs.house.gov committee meeting file.
const HOUSE_STATUS = { S: "Scheduled", P: "Postponed", C: "Canceled", R: "Rescheduled" };
export function parseHouseMeeting(doc, eventUrl) {
  const cm = doc?.["committee-meeting"];
  const d = cm?.["meeting-details"];
  if (!d) return null;
  const congress = Number(cm["@_congress-num"]);
  const type = String(cm["@_meeting-type"] ?? "");
  const committee = list(d.committees?.["committee-name"])[0];
  const loc = d["meeting-location"]?.field ?? d["meeting-location"];
  const title = text(d["meeting-title"]) ?? "Committee meeting";
  const start = text(d["meeting-date"]?.["start-time"]);
  let time = null;
  if (start) {
    const [h, mi] = start.split(":").map(Number);
    time = `${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  }
  return {
    event_id: `house-meeting-${String(cm["@_meeting-id"] ?? "").replace(/\D/g, "")}`,
    chamber: "house",
    kind: type === "HHRG" ? "hearing" : type === "HMKP" ? "markup" : "meeting",
    event_date: text(d["meeting-date"]?.["calendar-date"]), event_time: time, week_of: false,
    committee_id: committeeIdFromCode(committee?.["@_id"], "house"), committee_name: text(committee),
    title, category: null, bill_refs: refs(congress, title),
    location: [text(loc?.["building-name"]), text(loc?.["room-number"]), text(loc?.city)].filter(Boolean).join(", ") || null,
    status: HOUSE_STATUS[text(cm["current-status"])] ?? text(cm["current-status"]),
    source_url: eventUrl,
  };
}
