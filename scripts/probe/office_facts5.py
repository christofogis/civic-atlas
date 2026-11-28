"""Fifth pass for src/lib/offices.js: the officer sections of the Assembly Clerk's
"California's Legislature" (Controller, Treasurer, Attorney General, Lieutenant Governor,
Governor) and the Orange County Registrar's 2026 notice of election (county offices' terms).
Prints only; writes nothing."""
import re
import subprocess
import tempfile
import urllib.request

UA = {"User-Agent": "civic-atlas fact check (github.com/christofogis/civic-atlas)"}
DOCS = [
    ("https://clerk.assembly.ca.gov/sites/clerk.assembly.ca.gov/files/2117_Cal_Leg2016_Sec05_R4.pdf",
     [r"The Controller The", r"The Treasurer The", r"The Attorney General The", r"The Lieutenant Governor The", r"Commander in Chief", r"line item|reduce or eliminate|item veto"]),
    ("https://www.ocvote.gov/sites/default/files/2026-02/Notice%20of%20Election%20June%202%202026.pdf",
     [r"Assessor", r"Sheriff", r"District Attorney", r"Supervisor", r"term"]),
    ("https://ocvote.gov/election-library/docs/2026%20November%20Candidates%20Handbook.pdf",
     [r"four[- ]year", r"Los Alamitos", r"City Council"]),
]


def get(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read(20000000)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}", b""


for url, pats in DOCS:
    status, body = get(url)
    t = ""
    if body[:4] == b"%PDF":
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            f.write(body); f.flush()
            t = re.sub(r"\s+", " ", subprocess.run(["pdftotext", f.name, "-"], capture_output=True, text=True).stdout)
    print(f"\n=== {status} {url} ({len(t)} chars)")
    for p in pats:
        hits = [m.start() for m in re.finditer(p, t, re.I)][:2]
        if not hits:
            print(f"  [{p}] NOT FOUND")
        for h in hits:
            print(f"  [{p}] ...{t[max(0, h - 150):h + 1300]}...")
