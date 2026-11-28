"""Fourth pass for src/lib/offices.js: the Assembly Clerk's printings of the California
Constitution (Article IV and others), the officer sections of the Clerk's "California's
Legislature", the Orange County District Attorney's site, and whether each state's official
legislature website answers. Prints only; writes nothing."""
import html
import re
import subprocess
import tempfile
import urllib.request

UA = {"User-Agent": "civic-atlas fact check (github.com/christofogis/civic-atlas)"}
CLERK = "https://clerk.assembly.ca.gov/sites/clerk.assembly.ca.gov/files/"
PAGES = [
    (CLERK + "ARTICLE_IV_Session_2017-18.pdf", [r"Senate has a membership of 40|40 members|membership of 40", r"Assembly has a membership of 80|80 members|membership of 80", r"12 years", r"reduce or eliminate"]),
    (CLERK + "ARTICLE_V_Session_2017-18.pdf", [r"supreme executive power", r"elected every fourth year", r"chief law officer", r"casting vote", r"two terms"]),
    (CLERK + "ARTICLE_IX_Session_2017-18.pdf", [r"Superintendent of Public Instruction"]),
    (CLERK + "ARTICLE_XI_Session_2017-18.pdf", [r"elected governing body", r"sheriff"]),
    (CLERK + "ARTICLE_XIII_Session_2017-18.pdf", [r"Board of Equalization consists", r"annually assess"]),
    (CLERK + "ARTICLE_II_Session_2017-18.pdf", [r"nonpartisan"]),
    ("https://clerk.assembly.ca.gov/legislative-information/elected-officials", [r"Senat", r"Assembl"]),
    (CLERK + "2117_Cal_Leg2016_Sec05_R4.pdf", [r"The Secretary of State The Secretary of State", r"The Attorney General", r"The Controller", r"The Treasurer", r"Superintendent of Public Instruction The", r"Insurance Commissioner The", r"Board of Equalization The"]),
    ("https://orangecountyda.org/", [r"prosecut", r"Public Administrator"]),
    ("https://www.ocgov.com/gov/da", [r"prosecut"]),
]
LEGS = {
    "AL": "https://alison.legislature.state.al.us/", "AK": "https://akleg.gov/", "AZ": "https://www.azleg.gov/",
    "AR": "https://www.arkleg.state.ar.us/", "CA": "https://www.legislature.ca.gov/", "CO": "https://leg.colorado.gov/",
    "CT": "https://www.cga.ct.gov/", "DE": "https://legis.delaware.gov/", "FL": "https://www.leg.state.fl.us/",
    "GA": "https://www.legis.ga.gov/", "HI": "https://www.capitol.hawaii.gov/", "ID": "https://legislature.idaho.gov/",
    "IL": "https://www.ilga.gov/", "IN": "https://iga.in.gov/", "IA": "https://www.legis.iowa.gov/",
    "KS": "https://www.kslegislature.gov/", "KY": "https://legislature.ky.gov/", "LA": "https://legis.la.gov/",
    "ME": "https://legislature.maine.gov/", "MD": "https://mgaleg.maryland.gov/", "MA": "https://malegislature.gov/",
    "MI": "https://www.legislature.mi.gov/", "MN": "https://www.leg.mn.gov/", "MS": "https://www.legislature.ms.gov/",
    "MO": "https://www.moga.mo.gov/", "MT": "https://leg.mt.gov/", "NE": "https://nebraskalegislature.gov/",
    "NV": "https://www.leg.state.nv.us/", "NH": "https://www.gencourt.state.nh.us/", "NJ": "https://www.njleg.state.nj.us/",
    "NM": "https://www.nmlegis.gov/", "NY": "https://www.nysenate.gov/", "NY2": "https://nyassembly.gov/",
    "NC": "https://www.ncleg.gov/", "ND": "https://www.ndlegis.gov/", "OH": "https://www.legislature.ohio.gov/",
    "OK": "https://www.oklegislature.gov/", "OR": "https://www.oregonlegislature.gov/", "PA": "https://www.palegis.us/",
    "RI": "https://www.rilegislature.gov/", "SC": "https://www.scstatehouse.gov/", "SD": "https://sdlegislature.gov/",
    "TN": "https://www.capitol.tn.gov/", "TX": "https://capitol.texas.gov/", "UT": "https://le.utah.gov/",
    "VT": "https://legislature.vermont.gov/", "VA": "https://virginiageneralassembly.gov/", "WA": "https://leg.wa.gov/",
    "WV": "https://www.wvlegislature.gov/", "WI": "https://legis.wisconsin.gov/", "WY": "https://www.wyoleg.gov/",
    "DC": "https://dccouncil.gov/", "PR": "https://www.oslpr.org/",
}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.geturl(), r.read(8000000), r.headers.get("content-type", "")
    except urllib.error.HTTPError as e:
        return e.code, url, b"", ""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}", url, b"", ""


def text(body, ctype):
    if "pdf" in ctype or body[:4] == b"%PDF":
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            f.write(body); f.flush()
            return re.sub(r"\s+", " ", subprocess.run(["pdftotext", f.name, "-"], capture_output=True, text=True).stdout)
    s = body.decode("utf-8", "replace")
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s)))


for url, pats in PAGES:
    status, _, body, ctype = get(url)
    t = text(body, ctype)
    print(f"\n=== {status} {url} ({len(t)} chars)")
    for p in pats:
        hits = [m.start() for m in re.finditer(p, t, re.I)][:1]
        if not hits:
            print(f"  [{p}] NOT FOUND")
        for h in hits:
            print(f"  [{p}] ...{t[max(0, h - 200):h + 1100]}...")

print("\n=== state legislature sites")
for st, url in LEGS.items():
    status, final, body, ctype = get(url)
    m = re.search(rb"<title[^>]*>(.*?)</title>", body, re.S | re.I)
    print(st, status, url, "->", final, "|", re.sub(r"\s+", " ", m.group(1).decode("utf-8", "replace")).strip()[:80] if m else "")
