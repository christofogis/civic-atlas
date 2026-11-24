import { test } from "node:test";
import assert from "node:assert/strict";
import { XMLParser } from "fast-xml-parser";
import { parseHouseFloor, parseSenateHearings, parseSenateConvene, parseHouseMeeting, committeeIdFromCode } from "../lib/schedule.js";

const parse = (xml) => new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false }).parse(xml);

test("committee codes", () => {
  assert.equal(committeeIdFromCode("SSCM00", "senate"), "SSCM");
  assert.equal(committeeIdFromCode("SSCM01", "senate"), "SSCM01");
  assert.equal(committeeIdFromCode("WM00", "house"), "HSWM");
  assert.equal(committeeIdFromCode("WM03", "house"), "HSWM03");
  assert.equal(committeeIdFromCode("", "house"), null);
});

test("House floor schedule", () => {
  const xml = `<floorschedule congress-num="119" week-date="2026-11-16">
  <category type="Items that may be considered under suspension of the rules" sort-order="1"><floor-items>
    <floor-item id="409831" remove-date=""><legis-num>H.R. 7254 </legis-num><floor-text>To amend the National Trails System Act </floor-text></floor-item>
    <floor-item id="409840" remove-date="2026-11-17T10:00:00"><legis-num>H.R. 1 </legis-num><floor-text>Removed</floor-text></floor-item>
  </floor-items></category>
  <category type="Items that may be considered pursuant to a rule" sort-order="2"><floor-items>
    <floor-item id="409900" remove-date=""><legis-num>H. Res. 1665</legis-num><floor-text>Providing for consideration</floor-text></floor-item>
  </floor-items></category></floorschedule>`;
  const items = parseHouseFloor(parse(xml), "u");
  assert.equal(items.length, 2);
  assert.deepEqual(items[0].bill_refs, ["119-hr-7254"]);
  assert.equal(items[0].category, "suspension");
  assert.equal(items[0].event_date, "2026-11-16");
  assert.equal(items[1].category, "rule");
  assert.deepEqual(items[1].bill_refs, ["119-hres-1665"]);
});

test("Senate hearings skip the placeholder and read documents", () => {
  const xml = `<css_meetings_scheduled>
  <meeting><cmte_code/><committee/><date_iso_8601>2026-11-24</date_iso_8601><matter>No committee hearings scheduled</matter></meeting>
  <meeting><identifier>338860</identifier><cmte_code>SSCM00</cmte_code><committee>Commerce, Science, and Transportation</committee>
    <type>Open Hearing</type><date_iso_8601>2026-12-01</date_iso_8601><time>10:00 AM</time><room>SR-253</room>
    <Documents><AssociatedDocument congress="119" document_num="1425" document_prefix="PN"/><AssociatedDocument congress="119" document_num="1462" document_prefix="S"/></Documents>
    <matter>Hearings to examine nominations.</matter></meeting>
  <meeting><identifier>338901</identifier><cmte_code>SSRA00</cmte_code><committee>Rules and Administration</committee>
    <type>Open Business Meeting</type><date_iso_8601>2026-12-01</date_iso_8601><matter>Business meeting</matter></meeting>
  </css_meetings_scheduled>`;
  const m = parseSenateHearings(parse(xml));
  assert.equal(m.length, 2);
  assert.equal(m[0].committee_id, "SSCM");
  assert.equal(m[0].kind, "hearing");
  assert.deepEqual(m[0].bill_refs, ["119-s-1462"]);
  assert.equal(m[1].kind, "markup");
});

test("Senate next convening", () => {
  const xml = `<CongressSessionDayConvenings><LegislativeDay><SessionDay><NextConveneDate>2026-11-20T10:00:00-05:00</NextConveneDate></SessionDay></LegislativeDay>
  <LegislativeDay><SessionDay><NextConveneDate>2026-11-30T15:00:00-05:00</NextConveneDate></SessionDay></LegislativeDay></CongressSessionDayConvenings>`;
  const c = parseSenateConvene(parse(xml));
  assert.equal(c.event_date, "2026-11-30");
  assert.equal(c.event_time, "3:00 PM ET");
});

test("House committee meeting", () => {
  const xml = `<committee-meeting congress-num="119" meeting-id="HHRG119575" meeting-type="HMKP"><current-status>S</current-status>
  <meeting-details><committees><committee-name id="WM00">Committee on Ways and Means</committee-name></committees>
  <meeting-date><calendar-date>2026-12-02</calendar-date><start-time>14:00:00</start-time></meeting-date>
  <meeting-location><field><building-name>Longworth House Office Building</building-name><room-number>1100</room-number></field></meeting-location>
  <meeting-title>Markup of H.R. 10357 and H.R. 10334</meeting-title></meeting-details></committee-meeting>`;
  const m = parseHouseMeeting(parse(xml), "e");
  assert.equal(m.event_id, "house-meeting-119575");
  assert.equal(m.kind, "markup");
  assert.equal(m.committee_id, "HSWM");
  assert.equal(m.event_time, "2:00 PM");
  assert.deepEqual(m.bill_refs.sort(), ["119-hr-10334", "119-hr-10357"]);
  assert.equal(m.status, "Scheduled");
});
