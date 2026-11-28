"""Last pass for src/lib/offices.js: the Controller's and Treasurer's duties in the Assembly
Clerk's handbook, the budget bill in Article IV (Clerk's printing), the 25th Amendment, and
2 U.S.C. 2c (single-member House districts). Prints only; writes nothing."""
import re
import subprocess
import tempfile
import urllib.request

UA = {"User-Agent": "civic-atlas fact check (github.com/christofogis/civic-atlas)"}
DOCS = [
    ("https://clerk.assembly.ca.gov/sites/clerk.assembly.ca.gov/files/2117_Cal_Leg2016_Sec05_R4.pdf", [r"Controller is", r"Treasurer is", r"The Controller", r"The Treasurer"]),
    ("https://clerk.assembly.ca.gov/sites/clerk.assembly.ca.gov/files/ARTICLE_IV_Session_2017-18.pdf", [r"budget bill", r"Sec\. 12\. \(a\)"]),
    ("https://www.archives.gov/founding-docs/amendments-11-27", [r"the Vice President shall become President"]),
    ("https://www.govinfo.gov/link/uscode/2/2c?type=usc&year=mostrecent&link-type=html", [r"districts"]),
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
    if body[:4] == b"%PDF":
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            f.write(body); f.flush()
            t = subprocess.run(["pdftotext", f.name, "-"], capture_output=True, text=True).stdout
    else:
        t = re.sub(r"<[^>]+>", " ", body.decode("utf-8", "replace"))
    t = re.sub(r"\s+", " ", t)
    print(f"\n=== {status} {url} ({len(t)} chars)")
    for p in pats:
        hits = [m.start() for m in re.finditer(p, t)][:3]
        if not hits:
            print(f"  [{p}] NOT FOUND")
        for h in hits:
            print(f"  [{p}] ...{t[max(0, h - 150):h + 900]}...")
