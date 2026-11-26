"""California's results for the November 3, 2026 general election, from the Secretary of State.

    python3 scripts/data/ca_results.py      # writes public/data/state/ca-results-2026.json

Two sources, both the Secretary of State's own:
- While counties count ballots: the returns API behind electionresults.sos.ca.gov
  (api.sos.ca.gov/returns/<race>), one JSON document per race, with the SOS's "last updated" time.
  These results are semi-official.
- Once the Secretary of State certifies the election (scheduled for Dec 11, 2026): the Statement of
  Vote's spreadsheets (one row per county per candidate, or per county per measure), totaled here.
  When they are posted and cover every race, they replace the semi-official numbers and the file is
  marked certified; later runs then change nothing.

Races: the eight statewide offices, the four Board of Equalization districts, all 52 U.S. House
districts, and the statewide ballot measures. No U.S. Senate seat from California was on the 2026
ballot (the API answers 500 for it). Candidates, party and measure titles are kept as published.
Nobody is marked as winning: the SOS doesn't mark winners in either source.

A House candidate is linked to a member of Congress only when the name as printed equals one of a current
California House member's recorded names (official full name; first and last; nickname and last; first,
middle and last) after ignoring case and punctuation. Accented letters must match. Never by district
number: California used new maps in 2026.
"""
import io, json, os, re, sys, time, unicodedata, urllib.error, urllib.request, zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

API = "https://api.sos.ca.gov/returns/"
RESULTS_SITE = "https://electionresults.sos.ca.gov/"
SOV_INDEX = "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results"
ELECTION_PAGE = "https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026"
LEGISLATORS = "https://unitedstates.github.io/congress-legislators/legislators-current.json"
UA = {"User-Agent": "civic-atlas data build (github.com/christofogis/civic-atlas)"}
OUT = "public/data/state/ca-results-2026.json"
LA = ZoneInfo("America/Los_Angeles")

# Statewide offices in the order the ballot lists them; the API path is the office's key.
STATEWIDE = ["governor", "lieutenant-governor", "secretary-of-state", "controller", "treasurer",
             "attorney-general", "insurance-commissioner", "superintendent-of-public-instruction"]
BOE_DISTRICTS = range(1, 5)
HOUSE_DISTRICTS = range(1, 53)


def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code < 500 or i == tries - 1:
                raise
        except (urllib.error.URLError, TimeoutError):
            if i == tries - 1:
                raise
        time.sleep(3 * (i + 1))


# ---------- semi-official: the returns API ----------

def num(s):
    """'8,740,676' or '7912244' -> 8740676."""
    return int(str(s).replace(",", "").strip() or 0)


def pct(s):
    return float(str(s).strip() or 0)


def parse_time(s):
    """'November 25, 2026, 6:54 p.m.' (Pacific) -> ISO 8601 with offset; None if unreadable."""
    t = (s or "").strip().replace("a.m.", "AM").replace("p.m.", "PM").replace("noon", "12:00 PM")
    for fmt in ("%B %d, %Y, %I:%M %p", "%B %d, %Y, %I %p"):
        try:
            return datetime.strptime(t, fmt).replace(tzinfo=LA).isoformat()
        except ValueError:
            pass
    return None


def parse_race(d):
    """One race document from the returns API."""
    return {
        "race_title": d["raceTitle"],
        "reporting": d.get("Reporting"),
        "updated_text": d.get("ReportingTime"),
        "updated": parse_time(d.get("ReportingTime")),
        # Candidates in the order the SOS lists them; votes and percent as published.
        "candidates": [{"name": c["Name"].strip(), "party": (c.get("Party") or "").strip() or None,
                        "votes": num(c["Votes"]), "percent": pct(c["Percent"])} for c in d["candidates"]],
    }


def parse_measures(d):
    out = []
    for m in d["ballot-measures"]:
        out.append({"number": str(int(m["Number"])), "title": m["Name"].strip(),
                    "yes_votes": num(m["yesVotes"]), "yes_percent": pct(m["yesPercent"]),
                    "no_votes": num(m["noVotes"]), "no_percent": pct(m["noPercent"])})
    return {"reporting": d.get("Reporting"), "updated_text": d.get("ReportingTime"),
            "updated": parse_time(d.get("ReportingTime")), "measures": out}


def from_api(fetch):
    """Every race from the returns API. fetch(path) returns parsed JSON."""
    statewide = [{"office": k, "source_url": API + k, **parse_race(fetch(k))} for k in STATEWIDE]
    boe = [{"district": n, "source_url": f"{API}board-of-equalization/district/{n}",
            **parse_race(fetch(f"board-of-equalization/district/{n}"))} for n in BOE_DISTRICTS]
    house = [{"district": n, "source_url": f"{API}us-rep/district/{n}",
              **parse_race(fetch(f"us-rep/district/{n}"))} for n in HOUSE_DISTRICTS]
    m = parse_measures(fetch("ballot-measures"))
    for x in m["measures"]:
        x["source_url"] = API + "ballot-measures"
    return {"statewide": statewide, "boe": boe, "house": house, "measures": m["measures"]}


# ---------- certified: the Statement of Vote spreadsheets ----------

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def col_index(ref):
    letters = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def xlsx_rows(data):
    """Rows of the first sheet of an .xlsx as lists of strings (standard library only)."""
    z = zipfile.ZipFile(io.BytesIO(data))
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).iter(NS + "si"):
            shared.append("".join(t.text or "" for t in si.iter(NS + "t")))
    sheet = sorted(n for n in z.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml$", n))[0]
    for row in ET.fromstring(z.read(sheet)).iter(NS + "row"):
        cells = {}
        for c in row.findall(NS + "c"):
            v, t = c.find(NS + "v"), c.get("t")
            if t == "s" and v is not None:
                val = shared[int(v.text)]
            elif t == "inlineStr":
                val = "".join(x.text or "" for x in c.iter(NS + "t"))
            else:
                val = v.text if v is not None else ""
            cells[col_index(c.get("r"))] = val.strip()
        if cells:
            yield [cells.get(i, "") for i in range(max(cells) + 1)]


def records(data):
    it = xlsx_rows(data)
    head = [h.lower() for h in next(it)]
    for r in it:
        yield {h: (r[i] if i < len(r) else "") for i, h in enumerate(head)}


def contest_key(name):
    """Which race a Statement of Vote contest name is: ('statewide', key) / ('boe', n) / ('house', n) / None."""
    n = " ".join(re.sub(r"[^a-z0-9 ]", " ", name.lower()).split())
    for k in STATEWIDE:
        if n == k.replace("-", " "):
            return ("statewide", k)
    m = re.search(r"(?:board of equalization|boe)\D*(\d+)", n)
    if m:
        return ("boe", int(m.group(1)))
    m = re.search(r"(?:representative|congress|us rep)\D*(\d+)", n)
    if m and "senat" not in n and "assembly" not in n:
        return ("house", int(m.group(1)))
    return None


def tally(rows):
    """Sum county rows into candidates in first-seen order, with percent of the contest's total."""
    cands = {}
    for r in rows:
        key = r.get("candidate id") or r["candidate name"]
        c = cands.setdefault(key, {"name": r["candidate name"].strip(), "party": r.get("party name", "").strip() or None, "votes": 0})
        c["votes"] += num(r.get("vote total") or 0)
    total = sum(c["votes"] for c in cands.values())
    for c in cands.values():
        c["percent"] = round(100 * c["votes"] / total, 1) if total else 0.0
    return list(cands.values())


def is_total_row(r):
    """The files list counties; a statewide total row, if one is ever added, would double the sums."""
    return "total" in (r.get("county name") or "").lower() or not (r.get("county name") or "").strip()


def from_sov(cand_xlsx, measure_xlsx, cand_url, measure_url):
    """Races from the Statement of Vote spreadsheets; None for a race the files don't have."""
    by = {}
    for r in records(cand_xlsx):
        if is_total_row(r):
            continue
        k = contest_key(r.get("contest name", ""))
        if k:
            by.setdefault(k, []).append(r)
    def race(k, title):
        if k not in by:
            return None
        return {"race_title": by[k][0]["contest name"], "candidates": tally(by[k]), "source_url": cand_url}
    statewide = [race(("statewide", k), k) for k in STATEWIDE]
    boe = [race(("boe", n), n) for n in BOE_DISTRICTS]
    house = [race(("house", n), n) for n in HOUSE_DISTRICTS]
    ms = {}
    for r in records(measure_xlsx):
        if is_total_row(r):
            continue
        m = re.search(r"(\d+)", r.get("ballot measure name", ""))
        if not m:
            continue
        x = ms.setdefault(str(int(m.group(1))), {"number": str(int(m.group(1))), "title": r.get("ballot measure title", "").strip(),
                                                 "yes_votes": 0, "no_votes": 0, "source_url": measure_url})
        x["yes_votes"] += num(r.get("yes votes") or 0)
        x["no_votes"] += num(r.get("no votes") or 0)
    for x in ms.values():
        t = x["yes_votes"] + x["no_votes"]
        x["yes_percent"] = round(100 * x["yes_votes"] / t, 1) if t else 0.0
        x["no_percent"] = round(100 * x["no_votes"] / t, 1) if t else 0.0
    return {"statewide": statewide, "boe": boe, "house": house,
            "measures": sorted(ms.values(), key=lambda x: int(x["number"]))}


def merge_certified(api, sov):
    """Certified races carrying over the keys the page uses; None unless the files cover every race."""
    if any(x is None for x in sov["statewide"] + sov["boe"] + sov["house"]):
        return None
    if sorted(m["number"] for m in sov["measures"]) != sorted(m["number"] for m in api["measures"]):
        return None
    out = {"statewide": [], "boe": [], "house": [], "measures": sov["measures"]}
    for k in ("statewide", "boe", "house"):
        for a, s in zip(api[k], sov[k]):
            keep = {x: a[x] for x in ("office", "district") if x in a}
            out[k].append({**keep, **s, "reporting": None, "updated_text": None, "updated": None})
    return out


def find_sov(get_text):
    """The 2026 general election's Statement of Vote page and its candidate and measure spreadsheets.
    Returns (page_url, candidates_xlsx_url, measures_xlsx_url, certified_on) or None if not posted."""
    index = get_text(SOV_INDEX)
    pages = [h for h in re.findall(r'href="([^"]+)"', index)
             if re.search(r"general-election-nov[a-z]*-3-2026", h)]
    if not pages:
        return None
    page = pages[0] if pages[0].startswith("http") else "https://www.sos.ca.gov" + pages[0]
    if not page.rstrip("/").endswith("statement-vote"):
        sub = [h for h in re.findall(r'href="([^"]+)"', get_text(page)) if h.rstrip("/").endswith("statement-vote") and "2026" in h]
        if not sub:
            return None
        page = sub[0] if sub[0].startswith("http") else "https://www.sos.ca.gov" + sub[0]
    html = get_text(page)
    return parse_sov_page(page, html)


def parse_sov_page(page, html):
    links = re.findall(r'href="([^"]+\.xlsx)"', html)
    cand = [h for h in links if re.search(r"csv[-_](all[-_])?candidates", h, re.I)]
    meas = [h for h in links if re.search(r"csv[-_]ballot[-_]?measures", h, re.I)]
    if not cand or not meas:
        return None
    text = " ".join(re.sub(r"<[^>]+>", " ", html).split())
    on = None
    m = re.search(r"certif\w*[^.]{0,80}?((?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4})", text)
    if m:
        on = datetime.strptime(m.group(1), "%B %d, %Y").date().isoformat()
    return page, cand[0], meas[0], on


# ---------- members of Congress ----------

def norm(name):
    """Lower case, punctuation removed, spaces collapsed. Letters (accented ones too) are kept as they are."""
    s = unicodedata.normalize("NFC", name).lower()
    s = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in s)
    return " ".join(s.split())


def name_forms(n):
    """The member's name as the official record gives it: the official full name (what the site shows),
    first and last, nickname and last, first, middle and last (suffix optional). Each is compared whole."""
    last = n["last"]
    forms = [n.get("official_full"), f"{n['first']} {last}"]
    if n.get("nickname"):
        forms.append(f"{n['nickname']} {last}")
    if n.get("middle"):
        forms.append(f"{n['first']} {n['middle']} {last}")
    if n.get("suffix"):
        forms += [f"{f} {n['suffix']}" for f in list(forms) if f]
    return [f for f in forms if f]


def ca_house_members(legislators):
    """{normalized name form: bioguide} for current California House members. A form two members share
    is dropped, so it never links either of them."""
    out, shared = {}, set()
    for m in legislators:
        t = m["terms"][-1]
        if t["type"] != "rep" or t["state"] != "CA":
            continue
        b = m["id"]["bioguide"]
        for k in {norm(f) for f in name_forms(m["name"])}:
            if k in out and out[k] != b:
                shared.add(k)
            out[k] = b
    for k in shared:
        out.pop(k)
    return out


def link_members(house, members):
    """Mark House candidates whose printed name is a current California member's name. Returns the
    members not found on any ballot (for the log)."""
    found = set()
    for race in house:
        for c in race["candidates"]:
            b = members.get(norm(c["name"]))
            if b and b not in found:
                c["bioguide_id"] = b
                found.add(b)
    return sorted({b for b in members.values() if b not in found})


# ---------- build ----------

def build(api, legislators, sov=None, sov_meta=None, now=None):
    now = now or datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    races = api
    status, certified_on, page = "semi-official", None, None
    if sov is not None:
        merged = merge_certified(api, sov)
        if merged:
            races, status = merged, "certified"
            page, _, _, certified_on = sov_meta
    unmatched = link_members(races["house"], ca_house_members(legislators)) if legislators is not None else None
    times = [r["updated"] for r in races["statewide"] + races["boe"] + races["house"] if r.get("updated")]
    latest = max(times, key=lambda t: datetime.fromisoformat(t)) if times else None
    latest_text = next((r["updated_text"] for r in races["statewide"] + races["boe"] + races["house"] if r.get("updated") == latest), None)
    return {
        "state": "CA",
        "election": "2026-11-03",
        "election_name": "November 3, 2026, General Election",
        "status": status,
        "updated": latest,
        "updated_text": latest_text,
        "certified_on": certified_on,
        "certification_scheduled": "2026-12-11",
        "retrieved": now,
        "source": {
            "name": "California Secretary of State",
            "url": page or API,
            "results_site": RESULTS_SITE,
            "election_page": ELECTION_PAGE,
            "statement_of_vote": page,
        },
        "note": "Counts and percentages as published by the California Secretary of State. Semi-official results change as counties count ballots; the certified Statement of Vote replaces them. Civic Atlas does not call races.",
        **races,
        "_unmatched_ca_members": unmatched,
    }


def main():
    prev = None
    if os.path.exists(OUT):
        prev = json.load(open(OUT))
        if prev.get("status") == "certified":
            print("Already certified; nothing to update.")
            return
    fetch = lambda p: (time.sleep(0.3), json.loads(get(API + p)))[1]
    api = from_api(fetch)
    try:
        legislators = json.loads(get(LEGISLATORS))
    except Exception as e:  # keep the results; just no member links this run
        print("Couldn't read the member list:", e)
        legislators = None
    sov, meta = None, None
    try:
        meta = find_sov(lambda u: get(u).decode("utf8", "replace"))
        if meta:
            print("Statement of Vote posted:", meta[0])
            sov = from_sov(get(meta[1]), get(meta[2]), meta[1], meta[2])
    except Exception as e:
        print("Statement of Vote not read:", e)
    out = build(api, legislators, sov, meta)
    unmatched = out.pop("_unmatched_ca_members")
    if sov is not None and out["status"] != "certified":
        print("Statement of Vote found but doesn't cover every race yet; staying semi-official.")
    linked = [(r["district"], c["name"], c["bioguide_id"]) for r in out["house"] for c in r["candidates"] if c.get("bioguide_id")]
    print(f"Status: {out['status']}; last updated by the SOS: {out['updated_text']}")
    print(f"{len(out['statewide'])} statewide offices, {len(out['boe'])} BOE districts, {len(out['house'])} House districts, {len(out['measures'])} measures")
    print(f"House candidates linked to members: {len(linked)}")
    for d, n, b in linked:
        print(f"  CA-{d}: {n} -> {b}")
    if unmatched is not None:
        print(f"Current California House members not linked to any 2026 ballot name ({len(unmatched)}):")
        names = {m["id"]["bioguide"]: m["name"].get("official_full") or f"{m['name']['first']} {m['name']['last']}" for m in legislators}
        for b in unmatched:
            print("  ", b, names.get(b))
    # Same numbers as last time: leave the file (and its retrieval time) alone.
    if prev and {k: v for k, v in prev.items() if k != "retrieved"} == {k: v for k, v in out.items() if k != "retrieved"}:
        print("No change.")
        return
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1, ensure_ascii=False)
        f.write("\n")
    print("Wrote", OUT)


if __name__ == "__main__":
    sys.exit(main())
