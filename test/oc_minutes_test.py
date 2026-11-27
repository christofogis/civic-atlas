"""Parsing tests for scripts/data/oc_minutes.py on text laid out as pdftotext -layout prints the
Clerk's summary action minutes (no network). Run by test/ocMinutes.test.js under `npm test`."""
import os, sys, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "data"))
import oc_minutes as om  # noqa: E402

# Trimmed from the October 27, 2026 minutes: a regular item, a page break, then a supplemental item
# printed with a space before the period.
TEXT = """
                     SUMMARY ACTION MINUTES
DISCUSSION ITEMS (Items 25-26)
25.   OC Waste & Recycling - Approve amendment 1 to contract MA-299-24011626 with Ron Dietz
      Inc. for hydroseeding services - Districts 3, 4 and 5 (Click
      to View Files)
      ON THE MOTION OF CHAIR CHAFFEE, SECONDED BY VICE CHAIR FOLEY,
      APPROVED ITEM AS RECOMMENDED
      Ayes:   Nguyen, Sarmiento, Wagner, Chaffee and Foley
      MINUTES - BOARD OF SUPERVISORS' MEETING, TUESDAY, OCTOBER 27, 2026 - PAGE 8
                                Document Last Updated: 10/28/2026 10:04 AM
                     SUMMARY ACTION MINUTES
S25A . Chair Chaffee - Approve allocation of $3,500 from Fourth District discretionary funds to
      a community organization
      ON THE MOTION OF CHAIR CHAFFEE, SECONDED BY SUPERVISOR SARMIENTO,
      APPROVED ITEM AS RECOMMENDED
      Ayes:   Nguyen, Sarmiento, Wagner and Chaffee
      Abstained: Foley
S25B. Supervisor Wagner - Approve allocation from Third District discretionary funds
      ON THE MOTION OF SUPERVISOR WAGNER, SECONDED BY CHAIR CHAFFEE,
      APPROVED ITEM AS RECOMMENDED
      Ayes:   Nguyen, Sarmiento, Wagner, Chaffee and Foley
ADJOURNED
"""


class Minutes(unittest.TestCase):
    def test_supplemental_items_are_their_own_items(self):
        items = om.parse_text(TEXT)
        self.assertEqual([i["number"] for i in items], ["25", "S25A", "S25B"])
        self.assertEqual(len(items[0]["actions"]), 1)
        self.assertEqual(items[0]["actions"][0]["votes"], {"Ayes": ["Nguyen", "Sarmiento", "Wagner", "Chaffee", "Foley"]})
        self.assertEqual(items[1]["actions"][0]["votes"], {"Ayes": ["Nguyen", "Sarmiento", "Wagner", "Chaffee"], "Abstained": ["Foley"]})
        self.assertTrue(items[1]["text"].startswith("Chair Chaffee - Approve allocation of $3,500"))


if __name__ == "__main__":
    unittest.main()
