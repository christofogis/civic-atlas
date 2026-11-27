"""Audit of state, county and city data against primary sources. Prints only; writes nothing.
Part A: sample addresses (Census geocoder) -> districts, compared with the site's static maps and
the County's own GIS layer. Part B: official pages and APIs, printed as text snippets."""
import json, re, subprocess, sys, tempfile, urllib.parse, urllib.request, html

UA = {"User-Agent": "Mozilla/5.0 (civic-atlas audit probe; github.com/christofogis/civic-atlas)"}
PART = sys.argv[1] if len(sys.argv) > 1 else "all"


def get(url, timeout=60, raw=False):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
            b = r.read()
            return b if raw else b.decode("utf-8", "replace")
    except Exception as e:
        return None if raw else f"ERR {e}"


def text(h):
    h = re.sub(r"(?is)<(script|style|noscript).*?</\1>", " ", h)
    h = re.sub(r"(?s)<[^>]+>", " ", h)
    return re.sub(r"\s+", " ", html.unescape(h))


def show(label, url, pats=None, n=3000):
    print(f"\n===== {label}: {url}")
    t = get(url)
    if t.startswith("ERR"):
        print(t); return t
    tt = text(t)
    if pats:
        for p in pats:
            for m in list(re.finditer(p, tt, re.I))[:6]:
                print("  ...", tt[max(0, m.start() - 200): m.end() + 300])
    else:
        print(tt[:n])
    return t


def in_ring(x, y, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][:2]; xj, yj = ring[j][:2]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def containing(features, lon, lat):
    for f in features:
        g = f.get("geometry") or {}
        polys = [g["coordinates"]] if g.get("type") == "Polygon" else g.get("coordinates", []) if g.get("type") == "MultiPolygon" else []
        for p in polys:
            if in_ring(lon, lat, p[0]) and not any(in_ring(lon, lat, h) for h in p[1:]):
                return f["properties"]
    return None


ADDR = [
    "3191 Katella Ave, Los Alamitos, CA 90720",
    "3591 Cerritos Ave, Los Alamitos, CA 90720",
    "10900 Los Alamitos Blvd, Los Alamitos, CA 90720",
    "3331 Montecito Rd, Los Alamitos, CA 90720",  # Rossmoor (unincorporated)
    "20 Civic Center Plaza, Santa Ana, CA 92701",
    "200 S Anaheim Blvd, Anaheim, CA 92805",
    "1 Civic Center Plaza, Irvine, CA 92606",
    "2000 Main St, Huntington Beach, CA 92648",
    "211 8th St, Seal Beach, CA 90740",
    "200 Civic Center, Mission Viejo, CA 92691",
    "29551 Sienna Pkwy, Ladera Ranch, CA 92694",
    "303 W Commonwealth Ave, Fullerton, CA 92832",
    "11222 Acacia Pkwy, Garden Grove, CA 92840",
    "1315 10th St, Sacramento, CA 95814",
    "200 N Spring St, Los Angeles, CA 90012",
    "1 Dr Carlton B Goodlett Pl, San Francisco, CA 94102",
    "2600 Fresno St, Fresno, CA 93721",
]


def part_a():
    sup = json.load(open("public/maps/local/ca-orange-supervisors.json"))["features"]
    places = json.load(open("public/maps/local/ca-orange-places.json"))["features"]
    boe = json.load(open("public/maps/state/ca-boe.json"))["features"]
    for a in ADDR:
        u = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?" + urllib.parse.urlencode(
            {"address": a, "benchmark": "Public_AR_Current", "vintage": "Current_Current", "layers": "all", "format": "json"})
        t = get(u)
        try:
            m = json.loads(t)["result"]["addressMatches"][0]
        except Exception:
            print("ADDR", a, "NO MATCH", t[:200]); continue
        lon, lat = m["coordinates"]["x"], m["coordinates"]["y"]
        g = m["geographies"]
        pick = lambda k, f="NAME": [x.get(f) for x in g.get(k, [])]
        cd = [k for k in g if "Congressional" in k]
        up = [k for k in g if "Legislative Districts - Upper" in k]
        lo = [k for k in g if "Legislative Districts - Lower" in k]
        print(f"\nADDR {a} -> {lat:.5f},{lon:.5f} matched {m['matchedAddress']}")
        print("  census county", pick("Counties"), "place", pick("Incorporated Places"), "cdp", pick("Census Designated Places"))
        for k in cd + up + lo:
            print("  census", k, [x.get("BASENAME") or x.get("NAME") for x in g[k]])
        print("  site BOE", (containing(boe, lon, lat) or {}).get("district"))
        if "Orange" in str(pick("Counties")):
            s = containing(sup, lon, lat); p = containing(places, lon, lat)
            print("  site supervisor", s, "place", p)
            if p and p.get("type") == "City":
                fn = "public/maps/local/ca-orange-council/" + re.sub(r"[^a-z]+", "-", p["name"].lower()) + ".json"
                try:
                    print("  site council", containing(json.load(open(fn))["features"], lon, lat))
                except FileNotFoundError:
                    print("  site council: no file (at large)")
            q = "https://services.arcgis.com/UXmFoWC7yDHcDN5Q/ArcGIS/rest/services/OC_Supervisory_Districts/FeatureServer/31/query?" + urllib.parse.urlencode(
                {"geometry": f"{lon},{lat}", "geometryType": "esriGeometryPoint", "inSR": "4326", "spatialRel": "esriSpatialRelIntersects", "outFields": "*", "returnGeometry": "false", "f": "json"})
            r = get(q)
            try:
                print("  county GIS supervisor", [f["attributes"] for f in json.loads(r)["features"]])
            except Exception:
                print("  county GIS ERR", r[:200])


def part_b():
    show("OC board about", "https://board.oc.gov/about-board", [r"Chair", r"District \d"])
    show("OC elected officials", "https://www.ocgov.com/residents/gov/elected", None, 2500)
    show("ocvote results", "https://ocvote.gov/results", None, 2000)
    show("CA senators", "https://www.senate.ca.gov/senators", [r"District 10\b", r"Wahab", r"Vacant"])
    show("CA assembly", "https://www.assembly.ca.gov/assemblymembers", [r"Vacant", r"Macedo", r"Ellis", r"\b3\b.{0,40}Vacant"])
    show("SOS qualified", "https://www.sos.ca.gov/elections/ballot-measures/qualified-ballot-measures", [r"2028"])
    show("SOS eligible", "https://www.sos.ca.gov/elections/ballot-measures/initiative-and-referendum-status/eligible-statewide-initiative-measures", [r"1995", r"2028"])
    show("LAO 1495", "https://lao.ca.gov/BallotAnalysis/BallotDetail?id=1495", None, 800)
    show("SOS 2026 page", "https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026", [r"certif", r"Statement of Vote"])
    show("SOS upcoming", "https://www.sos.ca.gov/elections/upcoming-elections", None, 2500)
    show("SOS BOE members", "https://www.boe.ca.gov/members/", None, 1500)


def part_c():
    d = json.load(open("public/data/state/ca-results-2026.json"))
    diffs = 0; n = 0
    for grp in ("statewide", "boe", "house"):
        for r in d[grp]:
            t = get(r["source_url"])
            try:
                j = json.loads(t)
            except Exception:
                print("RES ERR", r["source_url"], t[:150]); continue
            live = [(c["Name"].strip(), (c.get("Party") or "").strip(), int(str(c["Votes"]).replace(",", "")), float(c["Percent"])) for c in j["candidates"]]
            ours = [(c["name"], c["party"] or "", c["votes"], c["percent"]) for c in r["candidates"]]
            n += 1
            if live != ours:
                diffs += 1
                print("RES DIFF", grp, r.get("office") or r.get("district"), "file", r["updated_text"], "live", j.get("ReportingTime"))
                print("   file", ours); print("   live", live)
    t = get("https://api.sos.ca.gov/returns/ballot-measures")
    j = json.loads(t)
    print("MEASURES live time", j.get("ReportingTime"))
    for m, x in zip(j["ballot-measures"], d["measures"]):
        lv = (str(int(m["Number"])), m["Name"].strip(), int(m["yesVotes"].replace(",", "")), float(m["yesPercent"]))
        if lv != (x["number"], x["title"], x["yes_votes"], x["yes_percent"]):
            print("  MEAS DIFF", lv, (x["number"], x["title"], x["yes_votes"], x["yes_percent"]))
    print("races compared", n, "differing", diffs)


def part_d():
    d = json.load(open("public/data/local/ca-orange-minutes.json"))
    want = {("2026-11-17", "4"), ("2026-11-17", "6"), ("2026-10-27", "25")}
    for m in d["meetings"]:
        if not any(m["date"] == w[0] for w in want): continue
        pdf = get(m["minutes_url"], raw=True)
        if not pdf: print("MIN ERR", m["minutes_url"]); continue
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f: f.write(pdf)
        txt = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True).stdout.splitlines()
        for (dt, num) in want:
            if dt != m["date"]: continue
            for i, l in enumerate(txt):
                if re.match(rf"^\s{{0,12}}{num}\.\s", l):
                    print(f"\n--- {dt} item {num}")
                    print("\n".join(txt[i:i + 18]))
                    break
    for u, lbl in [("https://board.oc.gov/sites/bos.egovoc.com/files/2026-11/2027%20Approved%20BOS%20Meeting%20Schedule.pdf", "2027 sched"),
                   ("https://board.oc.gov/sites/bos.egovoc.com/files/2025-11/2026%20APPROVED%20BOS%20Meeting%20Schedule.pdf", "2026 sched")]:
        pdf = get(u, raw=True)
        if not pdf: print(lbl, "ERR"); continue
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f: f.write(pdf)
        print("\n=====", lbl); print(subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True).stdout[:3500])


for p, fn in (("a", part_a), ("b", part_b), ("c", part_c), ("d", part_d)):
    if PART in ("all", p):
        try: fn()
        except Exception as e: print("PART", p, "FAILED", e)
