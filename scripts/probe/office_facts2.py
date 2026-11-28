"""Second pass for src/lib/offices.js. leginfo refuses automated requests (403), so the
California facts are checked against the Secretary of State's 2026 qualifications documents,
which state each office's term and cite the constitution and codes, and against each office's
own website. Also the delegate statutes (govinfo) and House Rule III. Prints only; writes nothing."""
import html
import re
import subprocess
import tempfile
import urllib.request

UA = {"User-Agent": "civic-atlas fact check (github.com/christofogis/civic-atlas)"}
Q = "https://elections.cdn.sos.ca.gov/statewide-elections/2026-primary/qualifications-requirements/"
PDFS = ["2026-governor-lt-governor.pdf", "2026-sos-controller-treasurer.pdf", "2026-attorney-general.pdf",
        "2026-insurance-commissioner.pdf", "2026-board-of-equalization.pdf", "2026-spi.pdf",
        "2026-state-senate.pdf", "2026-state-assembly.pdf"]
USC = "https://www.govinfo.gov/link/uscode/{t}/{s}?type=usc&year=mostrecent&link-type=html"
PAGES = [
    (USC.format(t="2", s="25a"), [r"Delegate", r"term|two years|Congress"]),
    (USC.format(t="48", s="891"), [r"Resident Commissioner", r"four years"]),
    (USC.format(t="48", s="1711"), [r"Delegate", r"two-year|two years"]),
    (USC.format(t="48", s="1731"), [r"Delegate", r"two-year|two years"]),
    (USC.format(t="48", s="1751"), [r"Delegate", r"two-year|two years"]),
    ("https://www.govinfo.gov/content/pkg/HMAN-119/html/HMAN-119-pg404.htm", [r"standing committees", r"same powers and privileges"]),
    ("https://www.boe.ca.gov/info/about.htm", [r"five-member|five members", r"property tax", r"assess"]),
    ("https://www.sco.ca.gov/eo_about.html", [r"chief fiscal officer", r"Controller"]),
    ("https://www.treasurer.ca.gov/about.asp", [r"banker", r"invest", r"bond"]),
    ("https://www.insurance.ca.gov/0500-about-us/", [r"regulat", r"elected"]),
    ("https://www.sos.ca.gov/administration/about-office-secretary-state", [r"chief elections officer", r"business"]),
    ("https://oag.ca.gov/office", [r"chief law officer", r"Attorney General"]),
    ("https://www.cde.ca.gov/eo/mn/ss/", [r"Superintendent", r"elected|nonpartisan"]),
]


def get(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read(5000000)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}: {e}", b""


def text(body):
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", body, flags=re.S | re.I)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body)))


for name in PDFS:
    status, body = get(Q + name)
    print(f"\n=== {status} {Q + name}")
    if status == 200:
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            f.write(body); f.flush()
            out = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True).stdout
        out = re.sub(r"[ \t]+", " ", out)
        print(out[:6000])

for url, pats in PAGES:
    status, body = get(url)
    t = text(body.decode("utf-8", "replace"))
    print(f"\n=== {status} {url} ({len(t)} chars)")
    for p in pats:
        hits = [m.start() for m in re.finditer(p, t, re.I)][:1]
        if not hits:
            print(f"  [{p}] NOT FOUND")
        for h in hits:
            print(f"  [{p}] ...{t[max(0, h - 300):h + 600]}...")
