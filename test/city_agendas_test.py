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


if __name__ == "__main__":
    unittest.main()
