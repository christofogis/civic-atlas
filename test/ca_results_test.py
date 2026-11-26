"""Parsing tests for scripts/data/ca_results.py on saved, trimmed responses (no network).
Run by test/caResults.test.js under `npm test`, or directly: python3 test/ca_results_test.py"""
import io, json, os, sys, unittest, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts", "data"))
import ca_results as cr  # noqa: E402

FIX = json.load(open(os.path.join(ROOT, "test", "fixtures", "ca-results-2026.json"), encoding="utf8"))
DOCS = FIX["api"]


def fake_fetch(path):
    """Saved responses; races not saved reuse one of the same kind, so every path resolves."""
    if path in DOCS:
        return DOCS[path]
    if path.startswith("us-rep/"):
        return DOCS["us-rep/district/45"]
    if path.startswith("board-of-equalization/"):
        return DOCS["board-of-equalization/district/2"]
    return DOCS["governor"]


def xlsx(rows):
    """A minimal .xlsx (first sheet only), strings shared or inline, numbers as values."""
    shared, sheet = [], []
    for i, r in enumerate(rows, 1):
        cells = []
        for j, v in enumerate(r):
            ref = chr(65 + j) + str(i)
            if isinstance(v, int):
                cells.append(f'<c r="{ref}"><v>{v}</v></c>')
            elif j % 2:
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{v}</t></is></c>')
            else:
                shared.append(v)
                cells.append(f'<c r="{ref}" t="s"><v>{len(shared) - 1}</v></c>')
        sheet.append(f'<row r="{i}">{"".join(cells)}</row>')
    ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("xl/sharedStrings.xml", f'<sst {ns}>' + "".join(f"<si><t>{s}</t></si>" for s in shared) + "</sst>")
        z.writestr("xl/worksheets/sheet1.xml", f'<worksheet {ns}><sheetData>{"".join(sheet)}</sheetData></worksheet>')
    return buf.getvalue()


CAND_HEAD = ["Election Date", "Election Name", "County Id", "County Name", "Contest ID", "Contest Name", "Candidate ID",
             "Candidate Name", "Incumbent Flag", "Write-in Flag", "Party ID", "Party Name", "Vote Total"]
MEAS_HEAD = ["Election Date", "Election Name", "County ID", "County Name", "Ballot Measure ID", "Ballot Measure Name",
             "Ballot Measure Title", "Yes Votes", "No Votes"]
TITLES = {"governor": "Governor", "lieutenant-governor": "Lieutenant Governor", "secretary-of-state": "Secretary of State",
          "controller": "Controller", "treasurer": "Treasurer", "attorney-general": "Attorney General",
          "insurance-commissioner": "Insurance Commissioner", "superintendent-of-public-instruction": "Superintendent of Public Instruction"}


def sov_files(skip_house=None):
    """Synthetic Statement of Vote spreadsheets: two counties, every race, two candidates each."""
    rows = [CAND_HEAD]
    contests = [t for t in TITLES.values()] + [f"Member, State Board of Equalization District {n}" for n in range(1, 5)] + \
               [f"United States Representative District {n}" for n in range(1, 53) if n != skip_house]
    for county in ["Alameda", "Alpine"]:
        for ci, c in enumerate(contests):
            name_a = "Derek Tran" if c.endswith("District 45") and "Representative" in c else f"Candidate A{ci}"
            rows.append(["11/03/2026", "November 3, 2026, General Election", "1", county, str(ci), c, f"{ci}1", name_a, "N", "N", "3", "Democratic", 300])
            rows.append(["11/03/2026", "November 3, 2026, General Election", "1", county, str(ci), c, f"{ci}2", f"Candidate B{ci}", "N", "N", "7", "Republican", 100])
    meas = [MEAS_HEAD]
    for county in ["Alameda", "Alpine", "State Totals"]:
        for n, t in [("1", "Housing Bonds"), ("4", "Public Financing"), ("5", "Recall Process"), ("39", "Voter ID")]:
            meas.append(["11/03/2026", "November 3, 2026, General Election", "1", county, "19" + n, f"Proposition {n}", t, 150, 50])
    return xlsx(rows), xlsx(meas)


class Feed(unittest.TestCase):
    def test_time(self):
        self.assertEqual(cr.parse_time("November 25, 2026, 6:54 p.m."), "2026-11-25T18:54:00-08:00")
        self.assertEqual(cr.parse_time("November 4, 2026, 12:05 a.m."), "2026-11-04T00:05:00-08:00")
        self.assertIsNone(cr.parse_time("soon"))

    def test_race(self):
        r = cr.parse_race(DOCS["governor"])
        self.assertEqual(r["race_title"], "Governor - Statewide Results")
        self.assertEqual(r["updated_text"], "November 25, 2026, 6:54 p.m.")
        self.assertEqual(r["candidates"][0], {"name": "Xavier Becerra", "party": "Dem", "votes": 8740676, "percent": 65.7})
        self.assertEqual(r["candidates"][1]["party"], "Rep")

    def test_order_as_published(self):
        # The SOS lists Insurance Commissioner candidates in ballot order, not by votes; kept that way.
        names = [c["name"] for c in cr.parse_race(DOCS["insurance-commissioner"])["candidates"]]
        self.assertEqual(names, ["Ben Allen", "Jane Kim"])

    def test_party_as_printed(self):
        self.assertEqual({c["party"] for c in cr.parse_race(DOCS["superintendent-of-public-instruction"])["candidates"]}, {"Non"})

    def test_measures(self):
        m = cr.parse_measures(DOCS["ballot-measures"])["measures"]
        self.assertEqual([x["number"] for x in m], ["1", "4", "5", "39"])
        self.assertEqual(m[0]["title"], "Authorizes Bonds For Housing Affordability Programs. Legislative Statute.")
        self.assertEqual((m[1]["yes_votes"], m[1]["yes_percent"], m[1]["no_votes"], m[1]["no_percent"]), (6354181, 49.8, 6399083, 50.2))

    def test_every_race(self):
        a = cr.from_api(fake_fetch)
        self.assertEqual([r["office"] for r in a["statewide"]], cr.STATEWIDE)
        self.assertEqual([r["district"] for r in a["boe"]], [1, 2, 3, 4])
        self.assertEqual([r["district"] for r in a["house"]], list(range(1, 53)))
        self.assertEqual(a["house"][0]["source_url"], "https://api.sos.ca.gov/returns/us-rep/district/1")


class Members(unittest.TestCase):
    def test_norm(self):
        self.assertEqual(cr.norm("Donald P. (Don) Wagner"), "donald p don wagner")
        self.assertEqual(cr.norm("  Chuong V. Vo "), "chuong v vo")
        # Accents are letters, not punctuation: no match across them.
        self.assertNotEqual(cr.norm("Nanette Diaz Barragan"), cr.norm("Nanette Diaz Barragán"))

    def test_ca_house_only(self):
        m = cr.ca_house_members(FIX["legislators"])
        self.assertEqual(m["derek tran"], "T000491")  # the synthetic senator of the same name isn't a House member
        self.assertNotIn("chuong v vo", m)            # Texas
        self.assertEqual(m["raul ruiz"], "R000599")   # no official full name: first and last
        self.assertEqual(m["lou correa"], "C001110")  # nickname and last
        self.assertEqual(m["ted w lieu"], "L000582")  # first, middle and last
        self.assertEqual(m["ted lieu"], "L000582")
        self.assertNotIn("pat smith", m)              # two members share it: links neither

    def test_link_by_name_not_district(self):
        house = [{"district": n, **cr.parse_race(DOCS[f"us-rep/district/{n}"])} for n in (29, 40, 45)]
        unmatched = cr.link_members(house, cr.ca_house_members(FIX["legislators"]))
        by = {(r["district"], c["name"]): c.get("bioguide_id") for r in house for c in r["candidates"]}
        # Two current members on one new-map ballot: both linked to the same race.
        self.assertEqual(by[(40, "Ken Calvert")], "C000059")
        self.assertEqual(by[(40, "Young Kim")], "K000397")
        self.assertEqual(by[(45, "Derek Tran")], "T000491")
        self.assertIsNone(by[(45, "Chuong V. Vo")])
        # "Angélica María Dueñas" isn't any of the member's recorded names exactly: left out.
        self.assertIsNone(by[(29, "Angélica María Dueñas")])
        self.assertIn("R000599", unmatched)


class Certified(unittest.TestCase):
    def setUp(self):
        self.api = cr.from_api(fake_fetch)
        self.api["measures"] = cr.parse_measures(DOCS["ballot-measures"])["measures"]

    def test_contest_names(self):
        self.assertEqual(cr.contest_key("Governor"), ("statewide", "governor"))
        self.assertEqual(cr.contest_key("Lieutenant Governor"), ("statewide", "lieutenant-governor"))
        self.assertEqual(cr.contest_key("United States Representative District 7"), ("house", 7))
        self.assertEqual(cr.contest_key("U.S. Representative District 52"), ("house", 52))
        self.assertEqual(cr.contest_key("Member, State Board of Equalization District 3"), ("boe", 3))
        self.assertIsNone(cr.contest_key("State Senate District 36"))
        self.assertIsNone(cr.contest_key("Member of the State Assembly District 72"))

    def test_totals_and_percent(self):
        c, m = sov_files()
        s = cr.from_sov(c, m, "C", "M")
        gov = s["statewide"][0]
        self.assertEqual(gov["candidates"][0], {"name": "Candidate A0", "party": "Democratic", "votes": 600, "percent": 75.0})
        # The "State Totals" row isn't added to the counties.
        self.assertEqual((s["measures"][0]["yes_votes"], s["measures"][0]["yes_percent"]), (300, 75.0))

    def test_certified_replaces_semi_official(self):
        c, m = sov_files()
        out = cr.build(self.api, FIX["legislators"], cr.from_sov(c, m, "C", "M"), ("PAGE", "C", "M", "2026-12-11"), now="2026-12-12T00:00:00+00:00")
        self.assertEqual(out["status"], "certified")
        self.assertEqual(out["certified_on"], "2026-12-11")
        self.assertEqual(out["source"]["url"], "PAGE")
        self.assertEqual(out["house"][44]["district"], 45)
        self.assertEqual(out["house"][44]["candidates"][0]["bioguide_id"], "T000491")
        self.assertIsNone(out["house"][44]["updated"])

    def test_incomplete_files_stay_semi_official(self):
        c, m = sov_files(skip_house=12)
        out = cr.build(self.api, None, cr.from_sov(c, m, "C", "M"), ("PAGE", "C", "M", None))
        self.assertEqual(out["status"], "semi-official")
        self.assertEqual(out["updated"], "2026-11-25T18:54:00-08:00")
        self.assertEqual(out["source"]["url"], "https://api.sos.ca.gov/returns/")

    def test_sov_page_links(self):
        html = ('<p>The Secretary of State certified the results on December 11, 2026.</p>'
                '<a href="https://elections.cdn.sos.ca.gov/sov/2026-general/sov/06-sov-summary.xlsx">Summary</a>'
                '<a href="https://elections.cdn.sos.ca.gov/sov/2026-general/sov/csv-candidates.xlsx">CSV Files - Voter Nominated (XLSX)</a>'
                '<a href="https://elections.cdn.sos.ca.gov/sov/2026-general/sov/csv-ballotmeasures.xlsx">CSV Files - Ballot Measures (XLSX)</a>')
        page, c, m, on = cr.parse_sov_page("P", html)
        self.assertTrue(c.endswith("csv-candidates.xlsx"))
        self.assertTrue(m.endswith("csv-ballotmeasures.xlsx"))
        self.assertEqual(on, "2026-12-11")
        self.assertIsNone(cr.parse_sov_page("P", "<p>Coming soon</p>"))


if __name__ == "__main__":
    unittest.main()
