"""Parsing tests for scripts/data/election_results.py on trimmed rows of the real sources (no network):
the FEC's Federal Elections 2022 workbook, the House Clerk's 2024 statistics (pdftotext -layout), and
the FEC's 2024 list of candidates on general-election ballots.
Run by test/electionResults.test.js under `npm test`, or directly: python3 test/election_results_test.py"""
import json, os, sys, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "data"))
import election_results as er  # noqa: E402

FIX = json.load(open(os.path.join(ROOT, "test", "fixtures", "election-results.json")))
NO_OWNERS = {}  # no crosswalk download in tests


def race(races, state, office, district=None, **kw):
    hits = [r for r in races if r["state"] == state and r["office"] == office and r["district"] == district
            and all(r.get(k) == v for k, v in kw.items())]
    assert len(hits) == 1, (state, office, district, kw, len(hits))
    return hits[0]


def by_name(r, part):
    hits = [c for c in r["candidates"] if part in c["name"]]
    assert len(hits) == 1, (part, [c["name"] for c in r["candidates"]])
    return hits[0]


class Fec2022(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        wb = FIX["fec2022"]
        cls.races = (er.parse_fec_sheet(wb["7. US Senate Results by State"], "2022-11-08", owners=NO_OWNERS)
                     + er.parse_fec_sheet(wb["8. US House Results by State"], "2022-11-08", owners=NO_OWNERS))
        cls.specials = er.parse_fec_sheet(wb["11. Special Elections 2021-2023"], specials=True, owners=NO_OWNERS)

    def test_general_only_and_as_printed(self):
        r = race(self.races, "AL", "H", 1)
        self.assertEqual([c["name"] for c in r["candidates"]], ["Carl, Jerry", "Remrey, Alexander M.", "Scattered"])
        carl = r["candidates"][0]
        self.assertEqual((carl["party"], carl["fec_ids"], carl["votes"], carl["pct"], carl["winner"], carl["incumbent"]),
                         ("R", ["H0AL01055"], 140592, 83.61, True, True))
        self.assertEqual(r["total_votes"], 168150)
        self.assertEqual(sum(c["votes"] for c in r["candidates"]), r["total_votes"])

    def test_runoff(self):
        r = race(self.races, "GA", "S")
        w = by_name(r, "Warnock")
        self.assertEqual((w["votes"], w["pct"], w["runoff_votes"], w["runoff_pct"], w["winner"]), (1946117, 49.44, 1820633, 51.4, True))
        self.assertFalse(by_name(r, "Walker")["winner"])
        self.assertEqual(r["runoff_total_votes"], 3541877)
        self.assertFalse(any("Black" in c["name"] for c in r["candidates"]))  # primary only

    def test_fusion_lines_total_from_combined_row(self):
        s = by_name(race(self.races, "NY", "S"), "Schumer")
        self.assertEqual((s["votes"], s["pct"], s["party"]), (3320561, 56.74, "D / WF"))
        self.assertEqual(s["lines"], [{"party": "D", "votes": 3022822, "pct": 51.65}, {"party": "WF", "votes": 297739, "pct": 5.09}])
        # Connecticut: the line rows don't repeat the combined total
        larson = by_name(race(self.races, "CT", "H", 1), "Larson")
        self.assertEqual((larson["votes"], larson["party"], len(larson["lines"])), (149556, "D / WF", 2))
        for r in self.races:
            if r["total_votes"]:
                self.assertEqual(sum(c["votes"] or 0 for c in r["candidates"]), r["total_votes"], (r["state"], r["district"]))

    def test_unopposed_has_no_count(self):
        c = race(self.races, "FL", "H", 5)["candidates"]
        self.assertEqual(len(c), 1)
        self.assertEqual((c[0]["votes"], c[0]["pct"], c[0]["unopposed"], c[0]["winner"]), (None, None, True, True))

    def test_full_and_unexpired_term_on_one_day(self):
        full = race(self.races, "IN", "H", 2, term="full")
        unexp = race(self.races, "IN", "H", 2, term="unexpired")
        self.assertFalse(full["special"])
        self.assertTrue(unexp["special"])
        self.assertEqual((full["total_votes"], unexp["total_votes"]), (194373, 188045))
        self.assertEqual(by_name(full, "Yakym")["name"], "Yakym, Rudolph (Rudy), III")  # footnote mark dropped

    def test_ranked_choice_final_round(self):
        r = race(self.races, "AK", "S")
        self.assertTrue(r["ranked_choice"])
        m = by_name(r, "Murkowski")
        self.assertEqual((m["pct"], m["rcv_final"]), (43.37, {"round": 3, "votes": 136330, "pct": 53.7}))

    def test_shared_id_dropped_or_given_to_its_member(self):
        r = race(self.races, "IL", "H", 3)
        self.assertEqual([c["fec_ids"] for c in r["candidates"]], [[], []])
        rows = FIX["fec2022"]["8. US House Results by State"]
        r = race(er.parse_fec_sheet(rows, "2022-11-08", owners={"H2IL03162": "Ramirez"}), "IL", "H", 3)
        self.assertEqual([(c["name"], c["fec_ids"]) for c in r["candidates"]], [("Ramirez, Delia", ["H2IL03162"]), ("Burau, Justin", [])])

    def test_special_elections_with_dates(self):
        r = race(self.specials, "LA", "H", 2)
        self.assertEqual((r["date"], r["runoff_date"], r["special"]), ("2021-03-20", "2021-04-24", True))
        self.assertTrue(by_name(r, "Carter, Troy")["winner"])
        ri = race(self.specials, "RI", "H", 1)
        self.assertEqual(ri["date"], "2023-11-07")
        self.assertTrue(by_name(ri, "Amo")["winner"])


class Clerk2024(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.races = er.parse_clerk(FIX["clerk2024"], "2024-11-05")

    def test_races_found(self):
        keys = sorted((r["state"], r["office"], r["district"] or 0, r["term"] or "") for r in self.races)
        self.assertEqual(keys, [("AZ", "H", 1, ""), ("AZ", "H", 2, ""), ("AZ", "S", 0, ""), ("CA", "H", 1, ""),
                                ("CA", "S", 0, "full"), ("CA", "S", 0, "unexpired"), ("DC", "H", 0, ""),
                                ("FL", "H", 19, ""), ("FL", "H", 20, ""), ("MA", "S", 0, ""),
                                ("NY", "H", 1, ""), ("NY", "H", 2, ""), ("NY", "H", 5, ""), ("NY", "S", 0, "")])

    def test_percent_calculated_without_blank_and_void(self):
        r = race(self.races, "NY", "S")
        g = by_name(r, "Gillibrand")
        self.assertEqual(g["party"], "Democrat / Working Families")
        self.assertEqual(g["votes"], 4318903 + 392395)
        total = 2917044 + 329070 + 4318903 + 392395 + 39413 + 13492
        self.assertEqual(r["total_votes"], total)
        self.assertEqual(g["pct"], round(100 * g["votes"] / total, 2))
        self.assertEqual([x["label"] for x in r["not_counted"]], ["Blank", "Void"])
        self.assertIsNone(g["winner"])  # the Clerk prints no winner

    def test_two_party_labels_on_one_line(self):
        k = by_name(race(self.races, "NY", "H", 5), "Paul King")
        self.assertEqual([x["party"] for x in k["lines"]], ["Republican", "Conservative, Common Sense"])
        self.assertEqual(k["votes"], 56689 + 5840)

    def test_party_line_only_in_fusion_states(self):
        r = race(self.races, "MA", "S")
        self.assertEqual([c["name"] for c in r["candidates"]], ["John Deaton", "Elizabeth Warren", "All Others"])
        self.assertEqual(by_name(r, "Warren")["party"], "Democrat")

    def test_unexpired_term_is_special(self):
        self.assertTrue(race(self.races, "CA", "S", term="unexpired")["special"])
        self.assertFalse(race(self.races, "CA", "S", term="full")["special"])

    def test_unopposed_with_footnote(self):
        c = race(self.races, "FL", "H", 20)["candidates"][0]
        self.assertEqual((c["name"], c["votes"], c["unopposed"]), ("Sheila Cherfilus-McCormick", None, True))
        self.assertIn("no opposition are not printed", c["note"])

    def test_delegate_and_vote_lines(self):
        r = race(self.races, "DC", "H", 0)
        self.assertEqual([x["label"] for x in r["not_counted"]], ["Under Votes", "Over Votes"])
        self.assertNotIn("Total", [c["name"] for c in r["candidates"]])
        self.assertEqual(r["printed_total"], r["total_votes"] + sum(x["votes"] for x in r["not_counted"]))

    def test_fec_ids_from_ballot_list(self):
        listed = er.ballot_list(FIX["ballot2024"])
        er.attach_fec_ids(self.races, listed, owners=NO_OWNERS)
        self.assertEqual(by_name(race(self.races, "CA", "S", term="full"), "Schiff")["fec_ids"], ["S4CA00555"])
        self.assertEqual(by_name(race(self.races, "NY", "H", 1), "LaLota")["fec_ids"], ["H2NY01190", "H0NY02200"])
        ny = race(self.races, "NY", "S")
        # The list prints one ID for both major candidates; without a crosswalk it is dropped from both.
        self.assertEqual((by_name(ny, "Gillibrand")["fec_ids"], by_name(ny, "Sapraicone")["fec_ids"]), ([], []))
        self.assertEqual(by_name(ny, "Sare")["fec_ids"], ["S2NY00325"])
        self.assertEqual(by_name(race(self.races, "AZ", "S"), "Shawn Petty")["fec_ids"], [])  # not on the list

    def test_general_election_day(self):
        self.assertEqual([er.general_election_day(y) for y in (2022, 2024, 2026, 2028)],
                         ["2022-11-08", "2024-11-05", "2026-11-03", "2028-11-07"])


if __name__ == "__main__":
    unittest.main()
