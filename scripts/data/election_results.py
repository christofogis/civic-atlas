"""Official general-election results for the U.S. Senate and House, one file per election year.

    python3 scripts/data/election_results.py              # every even year from 2022 to now
    python3 scripts/data/election_results.py 2024 2026     # only these years

Writes public/data/results/federal-{year}.json and public/data/results/index.json.

Sources, in order of preference for each year:
1. The FEC's "Federal Elections {year}" publication (fec.gov, Election results and voting information),
   compiled from each state's certified results. Its Excel workbook gives, per candidate, the FEC
   candidate ID, the party as printed, general-election votes and percent, any general-election
   runoff, New York-style combined party lines, ranked-choice rounds, and a winner indicator ("W").
   Special elections held between general elections are on their own sheet, with their dates.
   The FEC posts each year's workbook long after the election (the 2022 one appeared in 2025).
2. Until then, the House Clerk's "Statistics of the Presidential and Congressional Election"
   (clerk.house.gov), published a few months after the election. It prints each candidate's name,
   party and votes, and no FEC IDs, percentages or winners. For those years:
   - FEC IDs come from the FEC's list of congressional candidates on that year's general-election
     ballots ("{year}congressgecands.xlsx"), matched within the same race by last name (and first
     name when two share a last name). An ID that list gives to two candidates in one race is
     dropped from both, since it can't say whose it is.
   - Percent is calculated here: the candidate's votes over all votes printed for the race
     (candidates, write-ins, scattering), leaving out lines the Clerk prints for blank and void
     ballots. The file says so ("percent": "calculated").
   - No winner is marked: the Clerk doesn't print one, and most votes isn't always the winner
     (ranked-choice states, runoffs).

Names and parties are kept exactly as printed (the FEC prints "Last, First" and party codes; the
Clerk prints "First Last" and party names). Each year's file is rebuilt from scratch; a year whose
sources aren't published yet is skipped and any file already written for it is kept.
"""
import difflib, io, json, os, re, subprocess, sys, tempfile, unicodedata, urllib.error, urllib.request
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xlsx_rows import sheets  # noqa: E402

UA = {"User-Agent": "civic-atlas data build (github.com/christofogis/civic-atlas)"}
FEC = "https://www.fec.gov"
FEC_INDEX = FEC + "/introduction-campaign-finance/election-results-and-voting-information/"
FEC_PAGE = FEC_INDEX + "federal-elections-{year}/"
CLERK_PDF = "https://clerk.house.gov/member_info/electionInfo/{year}/statistics{year}.pdf"
OUT_DIR = "public/data/results"
FIRST_YEAR = 2022  # coverage starts with the 118th Congress, elected in 2022


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read()


def try_get(url):
    try:
        return get(url)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def general_election_day(year):
    """The Tuesday after the first Monday in November."""
    d = date(year, 11, 2)
    while d.weekday() != 1:
        d = d.replace(day=d.day + 1)
    return d.isoformat()


def clean(v):
    if isinstance(v, str):
        v = re.sub(r"\s+", " ", v).strip()
        return v or None
    return v


def num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def pct(frac):
    """The FEC prints percent as a fraction of all votes in the race; kept as a percent, 2 decimals."""
    return round(frac * 100, 2) if num(frac) is not None else None


# ---------------------------------------------------------------- FEC "Federal Elections" workbook

def district_of(raw):
    """FEC district cell -> (office, district, term). 'S', 'S-Unexpired Term', '07', '02-Full Term'."""
    raw = clean(str(raw)) if raw is not None else None
    raw = raw or ""
    m = re.match(r"^(S|\d{1,2})\s*(?:-\s*(Full|Unexpired) Term)?$", raw, re.I)
    if not m:
        return None
    office = "S" if m.group(1).upper() == "S" else "H"
    term = m.group(2).lower() if m.group(2) else None
    return office, (None if office == "S" else int(m.group(1))), term


def special_dates(text):
    """'Special General Election: 3/20/2021; Special General Runoff Election: 4/24/2021.'"""
    def iso(s):
        mo, d, y = s.split("/")
        return f"{y}-{int(mo):02d}-{int(d):02d}"
    g = re.search(r"Special General Election:\s*(\d{1,2}/\d{1,2}/\d{4})", text or "")
    r = re.search(r"Special General Runoff Election:\s*(\d{1,2}/\d{1,2}/\d{4})", text or "")
    return (iso(g.group(1)) if g else None), (iso(r.group(1)) if r else None)


def parse_fec_sheet(rows, default_date=None, specials=False, owners=None):
    """Races from one results sheet. Columns (0-based; column 0 is the FEC's row number):
    1 state, 3 district, 4 FEC ID, 5 incumbent "(I)", 8 name, 9 total-row label, 10 party,
    15/16 general votes/fraction, 17/18 general runoff votes/fraction, 19/20 combined party
    lines votes/fraction, 22 general winner indicator, 23 footnotes (special sheet: dates),
    24..29 ranked-choice rounds 1-3 votes/fraction."""
    races, order = {}, []
    for r in rows:
        r = list(r) + [None] * (30 - len(r))
        st = clean(r[1])
        if not st or not re.fullmatch(r"[A-Z]{2}", st):
            continue
        d = district_of(r[3])
        if not d:
            continue
        office, district, term = d
        when, runoff_when = (special_dates(r[23]) if specials else (default_date, None))
        if not when:
            continue
        key = (st, office, district, term, when)
        race = races.get(key)
        if race is None:
            race = races[key] = {"state": st, "office": office, "district": district, "date": when,
                                 "special": specials or term == "unexpired", "term": term,
                                 "runoff_date": runoff_when, "ranked_choice": False, "total_votes": None,
                                 "runoff_total_votes": None, "notes": [], "candidates": [], "_by": {}}
            order.append(key)
        note = clean(r[23]) if not specials else clean(r[25])
        if note and note not in race["notes"]:
            race["notes"].append(note)
        label = clean(r[9])
        if isinstance(label, str) and label.endswith("Votes:"):
            if label != "Party Votes:" and num(r[15]) is not None:  # race totals (party rows are primaries)
                race["total_votes"] = r[15]
                race["runoff_total_votes"] = num(r[17])
            continue
        name, party = clean(r[8]), clean(r[10])
        if not name or (isinstance(name, str) and re.fullmatch(r"DISTRICT \d+", name)):
            continue
        combined = party == "Combined Parties:"
        gen = r[15]
        in_general = combined or num(gen) is not None or clean(gen) == "Unopposed" or num(r[17]) is not None
        if not in_general:
            continue  # primary-only rows
        fec = clean(r[4])
        fec = fec if fec and re.fullmatch(r"[HSP]\w{8}", fec) else None
        name = re.sub(r"\s*[#*]+$", "", name)  # footnote markers after a name
        # Keyed by ID and name: the file sometimes repeats one candidate's ID on another's row.
        ck = (fec, re.sub(r"\W", "", name.split(",")[0]).lower()) if fec else (name, party)
        c = race["_by"].get(ck)
        if c is None:
            c = race["_by"][ck] = {"name": name, "party": None, "fec_ids": [fec] if fec else [],
                                   "incumbent": False, "votes": None, "pct": None, "winner": False,
                                   "unopposed": False, "_rows": [], "_combined": None}
            race["candidates"].append(c)
        if clean(r[5]) and "(I)" in clean(r[5]):
            c["incumbent"] = True
        if clean(r[22]) == "W":
            c["winner"] = True
        if combined:
            # The FEC's total for a candidate on more than one party line (New York, Connecticut, SC).
            c["_combined"] = (num(r[19]), pct(r[20]))
            continue
        if clean(gen) == "Unopposed":
            # Some states don't print unopposed candidates on the ballot, so there is no count.
            c["unopposed"] = True
            c["party"] = c["party"] or party
            continue
        if num(gen) is not None:
            c["_rows"].append({"party": party, "votes": gen, "pct": pct(r[16])})
            if num(r[19]) is not None:
                c["_combined"] = (num(r[19]), pct(r[20]))
        if num(r[17]) is not None:
            c["runoff_votes"], c["runoff_pct"] = r[17], pct(r[18])
        rounds = [(n, r[22 + 2 * n], r[23 + 2 * n]) for n in (1, 2, 3)]
        last = [x for x in rounds if num(x[1]) is not None]
        if last:
            race["ranked_choice"] = True
            n, v, f = last[-1]
            c["rcv_final"] = {"round": n, "votes": v, "pct": pct(f)}
    out = []
    for k in order:
        race = races[k]
        if not race["candidates"]:
            continue
        for c in race["candidates"]:
            rows_, comb = c.pop("_rows"), c.pop("_combined")
            if len(rows_) > 1 or comb:
                # More than one party line: the total is the FEC's combined row. (Without one, which
                # hasn't happened in the files so far, the lines are added up here.)
                c["lines"] = rows_
                c["party"] = " / ".join(x["party"] for x in rows_ if x["party"]) or c["party"]
                c["votes"], c["pct"] = comb or (sum(x["votes"] for x in rows_), round(sum(x["pct"] or 0 for x in rows_), 2))
            elif rows_:
                c["party"], c["votes"], c["pct"] = rows_[0]["party"], rows_[0]["votes"], rows_[0]["pct"]
        drop_shared_ids(race, owners)
        del race["_by"]
        out.append(race)
    return out


CROSSWALK = "https://unitedstates.github.io/congress-legislators/legislators-{which}.json"
_owners = None


def id_owners():
    """{FEC candidate ID: last name} for members of Congress, from unitedstates/congress-legislators
    (the same crosswalk members.fec_candidate_ids comes from). Empty if it can't be read."""
    global _owners
    if _owners is None:
        _owners = {}
        for which in ("current", "historical"):
            try:
                people = json.loads(get(CROSSWALK.format(which=which)))
            except Exception as e:  # noqa: BLE001 - optional; shared IDs are then just dropped
                print(f"  (couldn't read legislators-{which}.json: {e})")
                continue
            for p in people:
                if which == "historical" and p["terms"][-1]["end"] < "2021":
                    continue
                for i in p.get("id", {}).get("fec", []):
                    _owners[i] = p["name"]["last"]
    return _owners


def drop_shared_ids(race, owners=None):
    """An FEC ID printed for two different candidates in one race is a slip in the source. If the
    ID belongs to a member of Congress whose last name is in exactly one of those candidates'
    names, it stays with that candidate; otherwise it is dropped from both."""
    claims = {}
    for c in race["candidates"]:
        for i in set(c["fec_ids"]):
            claims.setdefault(i, []).append(c)
    for i, cs in claims.items():
        if len(cs) < 2:
            continue
        last = norm((owners if owners is not None else id_owners()).get(i, ""))
        keep = [c for c in cs if last and " ".join(last) in " ".join(norm(c["name"]))]
        for c in cs:
            if not (len(keep) == 1 and c is keep[0]):
                c["fec_ids"] = [x for x in c["fec_ids"] if x != i]


def fec_publication(year):
    """(page url, xlsx url) of the FEC's Federal Elections {year} publication, or None."""
    page = FEC_PAGE.format(year=year)
    body = try_get(page)
    if body is None:
        return None
    m = re.search(r'href="([^"]*federalelections%s\.xlsx)"' % year, body.decode("utf-8", "replace"))
    if not m:
        return None
    url = m.group(1)
    return page, (url if url.startswith("http") else FEC + url)


def from_fec(year, page, url):
    wb = sheets(io.BytesIO(get(url)))
    races = []
    for name, rows in wb.items():
        if re.search(r"Senate Results by State|House Results by State", name, re.I):
            races += parse_fec_sheet(rows, default_date=general_election_day(year))
    seen = {(r["state"], r["office"], r["district"], r["date"]) for r in races}
    for name, rows in wb.items():
        if re.search(r"Special Elections", name, re.I):
            for r in parse_fec_sheet(rows, specials=True):
                if (r["state"], r["office"], r["district"], r["date"]) not in seen:
                    races.append(r)
    return {"year": year, "percent": "as printed",
            "source": {"publisher": "Federal Election Commission", "title": f"Federal Elections {year}",
                       "page": page, "url": url}, "races": races}


# ---------------------------------------------------------- House Clerk's Statistics (PDF)

STATES = {"ALABAMA": "AL", "ALASKA": "AK", "ARIZONA": "AZ", "ARKANSAS": "AR", "CALIFORNIA": "CA",
          "COLORADO": "CO", "CONNECTICUT": "CT", "DELAWARE": "DE", "FLORIDA": "FL", "GEORGIA": "GA",
          "HAWAII": "HI", "IDAHO": "ID", "ILLINOIS": "IL", "INDIANA": "IN", "IOWA": "IA", "KANSAS": "KS",
          "KENTUCKY": "KY", "LOUISIANA": "LA", "MAINE": "ME", "MARYLAND": "MD", "MASSACHUSETTS": "MA",
          "MICHIGAN": "MI", "MINNESOTA": "MN", "MISSISSIPPI": "MS", "MISSOURI": "MO", "MONTANA": "MT",
          "NEBRASKA": "NE", "NEVADA": "NV", "NEW HAMPSHIRE": "NH", "NEW JERSEY": "NJ", "NEW MEXICO": "NM",
          "NEW YORK": "NY", "NORTH CAROLINA": "NC", "NORTH DAKOTA": "ND", "OHIO": "OH", "OKLAHOMA": "OK",
          "OREGON": "OR", "PENNSYLVANIA": "PA", "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC",
          "SOUTH DAKOTA": "SD", "TENNESSEE": "TN", "TEXAS": "TX", "UTAH": "UT", "VERMONT": "VT",
          "VIRGINIA": "VA", "WASHINGTON": "WA", "WEST VIRGINIA": "WV", "WISCONSIN": "WI", "WYOMING": "WY",
          "AMERICAN SAMOA": "AS", "DISTRICT OF COLUMBIA": "DC", "GUAM": "GU",
          "NORTHERN MARIANA ISLANDS": "MP", "PUERTO RICO": "PR", "VIRGIN ISLANDS": "VI"}
STATE_LINE = re.compile(r"^(%s)(—Continued)?$" % "|".join(sorted(STATES, key=len, reverse=True)))
# "1. Barry Moore, Republican ........ 191,939" / "   Write-in ....... 306" / "20. Name, Democrat ... (1)"
CAND = re.compile(r"^\s*(?:(\d{1,2})\.\s+)?(\S.*?)\s*\.{3,}[\s.]*([\d,]+|\(\d\))\s*$")
# Lines that aren't votes for anyone: blank, void, invalid, over/under votes, and ranked-choice
# ballot counts. Listed with the race, left out of the percent.
NOT_VOTES = re.compile(r"^(Blanks?|Blank votes|Void|Invalid|Over ?votes?|Under ?votes?|Continuing ballots|Exhausted ballots)\b", re.I)
# Votes not for a listed candidate, kept as their own line (name as printed, no party).
WRITE_IN = re.compile(r"^(Write-ins?|Other write-ins|Scattering|Scattered|All others|Others|Miscellaneous|None of these candidates)\b(\s*\(.*\))?$", re.I)
# States where one candidate can run on several party lines, printed one line per party.
FUSION_STATES = {"NY", "CT", "SC", "VT"}
RANKED_CHOICE_STATES = {"AK", "ME"}  # general elections for Congress by ranked-choice voting


def clerk_text(pdf):
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(pdf)
        f.flush()
        return subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True, check=True).stdout


def parse_clerk(text, when):
    """Races from the Clerk's statistics text. Candidates follow "FOR UNITED STATES SENATOR",
    "FOR UNITED STATES REPRESENTATIVE", "FOR DELEGATE" or "FOR RESIDENT COMMISSIONER"; a number
    before a name starts a district, "AT LARGE" a single seat, and "(For unexpired term ...)" a
    special election. A line with only a party name after a candidate is another party line for
    that candidate (New York's fusion lines), and is added to the candidate's total."""
    races, state, section, race, last = [], None, None, None, None
    notes = {}  # footnote number -> text, per state block

    def new_race(office, district, special=False, term=None):
        r = {"state": state, "office": office, "district": district, "date": when, "special": special,
             "term": term, "runoff_date": None, "ranked_choice": False, "total_votes": None,
             "runoff_total_votes": None, "notes": [], "candidates": [], "not_counted": []}
        races.append(r)
        return r

    lines = text.split("\n")
    for i, raw in enumerate(lines):
        s = re.sub(r"\s+", " ", raw).strip()
        if not s:
            continue
        m = STATE_LINE.match(s)
        if m:
            if not m.group(2):
                state, section, race, last, notes = STATES[m.group(1)], None, None, None, {}
            continue
        if state is None:
            continue
        # A footnote: its number alone on a line, then the text ("1" / "According to ... law, ...").
        if re.fullmatch(r"\d", s) and i + 1 < len(lines):
            nxt = re.sub(r"\s+", " ", lines[i + 1]).strip()
            if re.match(r"^[A-Z][a-z].*\.$", nxt) and "..." not in lines[i + 1]:
                notes[s] = nxt
                for r in races:
                    if r["state"] == state:
                        for c in r["candidates"]:
                            if c.get("_fn") == s:
                                c["note"] = nxt
                continue
        head = s.replace("—Continued", "")
        if head.startswith("FOR "):
            sec = {"FOR UNITED STATES SENATOR": "S", "FOR UNITED STATES REPRESENTATIVE": "H",
                   "FOR DELEGATE": "H", "FOR RESIDENT COMMISSIONER": "H"}.get(head)
            if s.endswith("—Continued") and sec == section:
                continue
            section, race, last = sec, None, None
            continue
        if s.startswith(("Recapitulation of Votes Cast", "Electoral Votes for President")):
            section, race, last = None, None, None
            continue
        if section is None:
            continue
        t = re.match(r"^\(For (unexpired|full) term", s)
        if t:
            race = new_race(section, None if section == "S" else (race or {}).get("district"),
                            special=t.group(1) == "unexpired", term=t.group(1))
            last = None
            continue
        if s == "AT LARGE":
            race, last = new_race("H", 0), None
            continue
        m = CAND.match(raw)
        if not m:
            continue
        dist, label, v = m.groups()
        votes = None if v.startswith("(") else int(v.replace(",", ""))
        fn = v.strip("()") if v.startswith("(") else None
        label = re.sub(r"\s+", " ", label).strip()
        if dist:
            race, last = new_race("H", int(dist)), None
        elif race is None:
            race = new_race(section, None if section == "S" else 0)
        if label == "Total":
            race["printed_total"] = votes
            continue
        if NOT_VOTES.match(label):
            race["not_counted"].append({"label": label, "votes": votes})
            continue
        if WRITE_IN.match(label):
            race["candidates"].append({"name": label, "party": None, "fec_ids": [], "votes": votes})
            last = None
            continue
        if "," in label:
            name, party = label.rsplit(",", 1)
            name, party = name.strip(), party.strip()
            # "Conservative, Common Sense ... 5,840": party lines, not a person ("Name, Party").
            if last and " " not in name and not re.search(r"[.“”\"]", name):
                party_line = label
            else:
                party_line = None
        else:
            name, party, party_line = None, None, label
        if party_line is not None:
            if last is None or state not in FUSION_STATES:
                race["candidates"].append({"name": label, "party": None, "fec_ids": [], "votes": votes})
                continue
            if "lines" not in last:
                last["lines"] = [{"party": last["party"], "votes": last["votes"]}]
            last["lines"].append({"party": party_line, "votes": votes})
            last["votes"] = sum(x["votes"] or 0 for x in last["lines"])
            last["party"] = " / ".join(x["party"] for x in last["lines"])
            continue
        c = {"name": name, "party": party, "fec_ids": [], "votes": votes}
        if votes is None:
            c["unopposed"] = True
            c["_fn"] = fn
            if fn in notes:
                c["note"] = notes[fn]
        race["candidates"].append(c)
        last = c
    out = []
    for r in races:
        if not r["candidates"]:
            continue
        counted = [c["votes"] for c in r["candidates"] if c["votes"] is not None]
        total = sum(counted) if counted else None
        r["total_votes"] = total
        r["ranked_choice"] = r["state"] in RANKED_CHOICE_STATES
        for c in r["candidates"]:
            c.pop("_fn", None)
            c["pct"] = round(100 * c["votes"] / total, 2) if total and c["votes"] is not None else None
            for x in c.get("lines", []):
                x["pct"] = round(100 * x["votes"] / total, 2) if total and x["votes"] is not None else None
            c.setdefault("incumbent", None)
            c["winner"] = None
        if not r["not_counted"]:
            del r["not_counted"]
        out.append(r)
    return out


def norm(s):
    s = re.sub(r"[’'`]", "", s or "")
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z ]+", " ", s.replace("-", " ")).split()


def ballot_list(rows_by_sheet):
    """The FEC's list of congressional candidates on general-election ballots:
    [(state, office, district, term, first, last, [fec ids])]."""
    out = []
    for rows in rows_by_sheet.values():
        for r in rows:
            r = list(r) + [None] * (9 - len(r))
            st = clean(r[0])
            if not st or not re.fullmatch(r"[A-Z]{2}", st):
                continue
            d = district_of(r[2])
            ids = re.findall(r"[HS]\d\w{7}", str(r[3] or ""))
            if not d or not ids:
                continue
            out.append((st, d[0], d[1], d[2], clean(r[5]) or "", clean(r[6]) or "", ids))
    return out


def attach_fec_ids(races, listed, owners=None):
    """Give each Clerk candidate the FEC IDs of the one candidate on the FEC's ballot list for the
    same race whose last name appears in the Clerk's printed name (first name breaks ties)."""
    matched = 0
    for race in races:
        pool = [x for x in listed if x[0] == race["state"] and x[1] == race["office"]
                and (race["office"] == "S" or x[2] == race["district"])]
        if race["office"] == "S" and any(x[3] for x in pool):
            pool = [x for x in pool if (x[3] == "unexpired") == bool(race["special"])] or pool
        pool = list({(x[4], x[5], tuple(x[6])): x for x in pool}.values())  # a race listed twice
        for c in race["candidates"]:
            if not c.get("party"):
                continue
            words = norm(c["name"])
            hits = [x for x in pool if norm(x[5]) and " ".join(norm(x[5])) in " ".join(words)]
            if len(hits) > 1:
                hits = [x for x in hits if norm(x[4]) and norm(x[4])[0] in words]
            if not hits:
                # A spelling difference between the two lists ("Pettersen" / "Petterson"): same first
                # name and a last name that differs by a letter or two.
                hits = [x for x in pool if norm(x[4]) and norm(x[4])[0] in words and norm(x[5]) and any(
                    difflib.SequenceMatcher(None, " ".join(norm(x[5])), w).ratio() >= 0.85 for w in words)]
            if len(hits) == 1:
                c["fec_ids"] = list(hits[0][6])
        drop_shared_ids(race, owners)
        matched += sum(bool(c["fec_ids"]) for c in race["candidates"])
    return matched


def ballot_list_url(year):
    body = try_get(FEC_INDEX)
    if body is None:
        return None
    m = re.search(r'href="([^"]*%scongressgecands\.xlsx)"' % year, body.decode("utf-8", "replace"))
    return (m.group(1) if m.group(1).startswith("http") else FEC + m.group(1)) if m else None


def from_clerk(year, pdf, url):
    races = parse_clerk(clerk_text(pdf), general_election_day(year))
    doc = {"year": year, "percent": "calculated",
           "source": {"publisher": "Clerk of the U.S. House of Representatives",
                      "title": f"Statistics of the Presidential and Congressional Election of {year}",
                      "page": "https://history.house.gov/Institution/Election-Statistics/Election-Statistics/",
                      "url": url}, "races": races}
    lu = ballot_list_url(year)
    if lu:
        n = attach_fec_ids(races, ballot_list(sheets(io.BytesIO(get(lu)))))
        doc["fec_ids_from"] = {"title": f"{year} Congressional Candidates on the General Election Ballots", "url": lu}
        print(f"  FEC IDs matched for {n} candidates from {lu}")
    return doc


# ------------------------------------------------------------------------------------------ main

def build(year):
    pub = fec_publication(year)
    if pub:
        doc = from_fec(year, *pub)
    else:
        url = CLERK_PDF.format(year=year)
        pdf = try_get(url)
        if not pdf or not pdf.startswith(b"%PDF"):
            return None
        doc = from_clerk(year, pdf, url)
    doc["source"]["retrieved"] = date.today().isoformat()
    return doc


def main(years):
    os.makedirs(OUT_DIR, exist_ok=True)
    idx_path = os.path.join(OUT_DIR, "index.json")
    index = json.load(open(idx_path)) if os.path.exists(idx_path) else {"files": []}
    files = {f["year"]: f for f in index["files"]}
    for year in years:
        print(f"{year}:")
        doc = build(year)
        if not doc:
            print("  no results published yet (FEC Federal Elections or House Clerk statistics)")
            continue
        races = doc["races"]
        print(f"  {doc['source']['title']}: {sum(r['office'] == 'S' for r in races)} Senate and "
              f"{sum(r['office'] == 'H' for r in races)} House races, "
              f"{sum(len(r['candidates']) for r in races)} candidate lines")
        name = f"federal-{year}.json"
        with open(os.path.join(OUT_DIR, name), "w") as f:
            json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        files[year] = {"year": year, "file": name, "source": doc["source"]["publisher"],
                       "title": doc["source"]["title"], "retrieved": doc["source"]["retrieved"]}
    index["files"] = [files[y] for y in sorted(files)]
    with open(idx_path, "w") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    args = [int(a) for a in sys.argv[1:]]
    main(args or list(range(FIRST_YEAR, date.today().year + 1, 2)))
