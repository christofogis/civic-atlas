"""Parsing tests for scripts/data/city_agendas.py on saved, trimmed responses (no network).
Run by test/cityAgendas.test.js under `npm test`, or directly: python3 -m unittest test/city_agendas_test.py"""
import json, os, sys, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "data"))
import city_agendas as ca  # noqa: E402

FIX = json.load(open(os.path.join(ROOT, "test", "fixtures", "civicclerk-laguna-hills.json")))
API = "https://lagunahillsca.api.civicclerk.com/v1/"


class CivicClerkMeeting(unittest.TestCase):
    def setUp(self):
        self.m = ca.civicclerk_meeting(FIX["event"], "lagunahillsca", FIX["meeting"])
        self.by_file = {i["file"]: i for i in self.m["items"]}

    def test_meeting_fields(self):
        m = self.m
        self.assertEqual(m["body"], "City Council / Planning Agency Regular Meeting")
        self.assertEqual((m["date"], m["time"]), ("2026-11-10", "6:00 PM"))  # local clock time, not converted
        self.assertEqual(m["location"], "City Council Chamber, 24035 El Toro Road")
        self.assertEqual(m["agenda_url"], API + "Meetings/GetMeetingFileStream(fileId=3030,plainText=false)")
        self.assertEqual(m["meeting_url"], "https://lagunahillsca.portal.civicclerk.com/event/843/files")
        self.assertEqual(set(m), {"body", "date", "time", "location", "agenda_url", "meeting_url", "agenda_status", "items"})

    def test_same_filter_as_legistar(self):
        titles = [i["title"] for i in self.m["items"]]
        # Procedure and sections without a number or attachments are not items.
        for t in ["Call to Order", "Adjournment", "Consent Calendar", "Presentations and Proclamations", "Planning Agency"]:
            self.assertNotIn(t, titles)
        # Every kept item has a file number or attachments.
        for i in self.m["items"]:
            self.assertTrue(i["file"] or i["attachments"], i)
        # Deleted items and unpublished attachments are dropped (the synthetic item has nothing else).
        self.assertFalse(any("SYNTHETIC" in t for t in titles))

    def test_numbered_section_is_a_heading_not_an_item(self):
        # "Planning Agency Public Hearings" carries a number (2026-1057) but holds the hearing items.
        self.assertNotIn("2026-1057", self.by_file)
        hearing = self.by_file["2026-1158"]
        self.assertEqual(hearing["heading"], "5. Planning Agency — 3. Planning Agency Public Hearings")
        self.assertEqual(hearing["number"], "1")

    def test_headings_and_numbers(self):
        self.assertEqual(self.by_file["2026-1187"]["heading"], "4. Consent Calendar")
        self.assertEqual(self.by_file["2026-1187"]["number"], "2.")
        self.assertEqual(self.by_file["2026-1065"]["heading"], "Announcement of Closed Session Item(s)")
        self.assertIsNone(self.by_file["2026-1065"]["number"])

    def test_titles_verbatim_without_markup(self):
        self.assertEqual(self.by_file["2026-1051"]["title"], "Schedule of Future Events")
        self.assertTrue(self.by_file["2026-1065"]["title"].startswith(
            "A. Public Employee Performance Evaluation Pursuant to Government Code Section 54957(b)(1) Public Employee"))

    def test_attachment_links_are_the_citys_own(self):
        atts = self.by_file["2026-1051"]["attachments"]
        self.assertEqual(atts[0], {"name": "Excursion to Sony Pictures_Flyer_", "url": API + "Meetings/GetAttachmentFile(fileId=2305)"})

    def test_no_items_until_agenda_published(self):
        e = dict(FIX["event"], publishedFiles=[])
        m = ca.civicclerk_meeting(e, "lagunahillsca", FIX["meeting"])
        self.assertEqual(m["items"], [])
        self.assertIsNone(m["agenda_url"])


class Helpers(unittest.TestCase):
    def test_cc_time(self):
        self.assertEqual(ca.cc_time("2026-12-08T18:30:00Z"), "6:30 PM")
        self.assertEqual(ca.cc_time("2026-12-04T10:00:00Z"), "10:00 AM")
        self.assertEqual(ca.cc_time("2026-12-04T12:00:00Z"), "12:00 PM")
        self.assertEqual(ca.cc_time("2026-12-04T00:05:00Z"), "12:05 AM")
        self.assertIsNone(ca.cc_time(None))

    def test_cc_text(self):
        self.assertEqual(ca.cc_text("<p>Public Comments</p><p>Persons wishing &amp; more</p>"), "Public Comments Persons wishing & more")

    def test_is_council(self):
        self.assertTrue(ca.is_council({"categoryName": "General", "eventName": "City Council Meeting"}))
        self.assertTrue(ca.is_council({"categoryName": "City Council / Planning Agency", "eventName": "Regular Meeting"}))
        self.assertFalse(ca.is_council({"categoryName": "Planning Commission", "eventName": "Planning Commission Meeting"}))

    def test_los_alamitos_not_enabled(self):
        self.assertNotIn("Los Alamitos", ca.CIVICCLERK)
        self.assertNotIn("Los Alamitos", ca.CITIES)


class Legistar(unittest.TestCase):
    def test_filter_and_headings(self):
        raw = [
            {"EventItemAgendaSequence": 1, "EventItemTitle": "ROLL CALL"},
            {"EventItemAgendaSequence": 2, "EventItemTitle": "CONSENT CALENDAR"},
            {"EventItemAgendaSequence": 3, "EventItemTitle": "Approve  the minutes", "EventItemMatterFile": "26-1",
             "EventItemAgendaNumber": "1.", "EventItemMatterAttachments": [
                 {"MatterAttachmentName": "Minutes", "MatterAttachmentHyperlink": "https://x.legistar.com/a.pdf"}]},
            {"EventItemAgendaSequence": 4, "EventItemTitle": "Mayor's remarks, as needed"},
        ]
        items = ca.legistar_items(raw)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["heading"], "Consent Calendar")
        self.assertEqual(items[0]["title"], "Approve the minutes")
        self.assertEqual(items[0]["attachments"], [{"name": "Minutes", "url": "https://x.legistar.com/a.pdf"}])


PG = os.path.join(ROOT, "test", "fixtures", "primegov")
with open(os.path.join(PG, "meetings.json"), encoding="utf-8") as _f:
    PGM = json.load(_f)


def pg_page(tenant):
    with open(os.path.join(PG, f"{tenant}.html"), encoding="utf-8") as f:
        return f.read()


class PrimeGovItems(unittest.TestCase):
    """Saved, trimmed HTML agendas from each city's PrimeGov portal: same layout in all four."""

    def items(self, tenant):
        return ca.primegov_items(pg_page(tenant), tenant)

    def test_same_filter(self):
        # PrimeGov shows no file numbers, so only items with documents are kept; sections, roll
        # call and items without documents (Santa Ana's ceremonial presentations) are not items.
        for t in ["lagunabeachcity", "lakeforest", "santa-ana", "sealbeach"]:
            items = self.items(t)
            self.assertTrue(items, t)
            for i in items:
                self.assertTrue(i["attachments"], (t, i))
                self.assertIsNone(i["file"])
                self.assertNotIn(i["title"].upper(), {"ROLL CALL", "COUNCIL ROLL CALL", "PUBLIC HEARING", "CEREMONIAL PRESENTATIONS"})
        sa = self.items("santa-ana")
        self.assertEqual([i["number"] for i in sa], ["38."])
        sb = [i["title"] for i in self.items("sealbeach")]
        self.assertNotIn("Recognizing City Staff Veterans", sb)  # no documents
        self.assertEqual(len(sb), 3)

    def test_headings_from_sections(self):
        lb = self.items("lagunabeachcity")
        self.assertEqual([(i["number"], i["heading"]) for i in lb], [("1.", "E. PRESENTATIONS."), ("18.", "I. REGULAR BUSINESS.")])
        self.assertEqual(self.items("lakeforest")[0]["heading"], "PUBLIC HEARING(S) (Item No. 12)")
        self.assertEqual(self.items("santa-ana")[0]["heading"], "PUBLIC HEARING")
        self.assertEqual(self.items("sealbeach")[-1]["heading"], "NEW BUSINESS")

    def test_title_is_first_line_as_printed(self):
        lf = self.items("lakeforest")[0]
        self.assertEqual(lf["title"], "AUTHORIZING APPLICATION FOR PERMANENT LOCAL HOUSING ALLOCATION PROGRAM GRANT AND APPROVAL OF THE PROPOSED FIVE-YEAR PLAN")
        self.assertEqual(self.items("santa-ana")[0]["title"], "Approve the Tax Equity Fiscal Responsibility Act Hearing for 1200 Main Apartments")
        self.assertNotIn("Recommendations", self.items("lagunabeachcity")[0]["title"])

    def test_attachment_links(self):
        a = self.items("lakeforest")[0]["attachments"][0]
        self.assertEqual(a["name"], "City Council Staff Report")
        self.assertTrue(a["url"].startswith("https://lakeforest.primegov.com/api/compilemeetingattachmenthistory/historyattachment/?historyId="))
        self.assertLessEqual(max(len(i["attachments"]) for i in self.items("santa-ana")), 6)

    def test_placeholder_and_repeat_links_skipped(self):
        page = ("<div class='meeting-item' data-itemid='1'><table><tr><td class='number-cell'>1.</td>"
                "<td class='item-cell'><div class='agenda-item'><b>AN ITEM</b><br>Recommended action.</div>"
                "<a href='/api/compilemeetingattachmenthistory/historyattachment/?historyId=a' title='Download Staff Report'>Staff Report</a>"
                "<a href='/api/compilemeetingattachmenthistory/historyattachment/?historyId=a' title='Download Staff Report'>Staff Report</a>"
                "<a href='/api/compilemeetingattachmenthistory/historyattachment/?historyId=${item.id}' title='Download ${item.name}'>x</a>"
                "</td></tr></table></div>")
        items = ca.primegov_items(page, "x")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "AN ITEM")
        self.assertEqual([a["name"] for a in items[0]["attachments"]], ["Staff Report"])


class PrimeGovMeetings(unittest.TestCase):
    def test_meeting_fields_and_links(self):
        m = ca.primegov_meeting(PGM["lakeforest"], "lakeforest", pg_page("lakeforest"))
        self.assertEqual((m["date"], m["time"]), ("2026-12-01", "6:30 PM"))
        self.assertEqual(m["body"], "City Council - Regular Meeting")
        self.assertEqual(m["agenda_url"], "https://lakeforest.primegov.com/Public/CompiledDocument?meetingTemplateId=12223&compileOutputType=1")
        self.assertEqual(m["meeting_url"], "https://lakeforest.primegov.com/Portal/Meeting?meetingTemplateId=12225")
        self.assertEqual(set(m), {"body", "date", "time", "location", "agenda_url", "meeting_url", "agenda_status", "items"})
        self.assertEqual(len(m["items"]), 1)

    def test_packet_only_city_reads_packet_html(self):
        pdf, htm = ca.pg_docs(PGM["sealbeach"])
        self.assertEqual((pdf["templateId"], htm["templateId"]), (8535, 8537))
        sb = ca.primegov_meeting(PGM["sealbeach"], "sealbeach", pg_page("sealbeach"))
        self.assertIsNone(sb["location"])
        self.assertEqual(sb["time"], "7:00 PM")

    def test_cancellation_notice_is_not_an_agenda(self):
        m = ca.primegov_meeting(PGM["santa_ana_cancelled"], "santa-ana", None)
        self.assertIsNone(m["agenda_url"])
        self.assertEqual(m["items"], [])
        self.assertEqual(m["meeting_url"], "https://santa-ana.primegov.com/public/portal")
        self.assertEqual(m["body"], "CANCELLED- Regular City Council Meeting")

    def test_which_meetings_are_council(self):
        for m in PGM["council"]:
            self.assertTrue(ca.pg_is_council(m), m["title"])
        for m in PGM["not_council"]:
            self.assertFalse(ca.pg_is_council(m), m["title"])


if __name__ == "__main__":
    unittest.main()
