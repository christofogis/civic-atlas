"""Third pass for src/lib/offices.js: delegate statutes in full, the Legislature's own printing
of the California Constitution, and the Orange County officers' and state offices' own sites.
Prints passages only; writes nothing."""
import html
import re
import subprocess
import tempfile
import urllib.request

UA = {"User-Agent": "civic-atlas fact check (github.com/christofogis/civic-atlas)"}
USC = "https://www.govinfo.gov/link/uscode/{t}/{s}?type=usc&year=mostrecent&link-type=html"
PAGES = [
    (USC.format(t="2", s="25a"), [r"right of debate", r"term"]),
    (USC.format(t="48", s="1712"), [r"term|every second year|two years"]),
    (USC.format(t="48", s="1732"), [r"term|every second year|two years"]),
    ("https://www.archives.gov/founding-docs/constitution-transcript", [r"shall be apportioned", r"advice and consent|Advice and Consent", r"take Care"]),
    ("https://clerk.assembly.ca.gov/sites/clerk.assembly.ca.gov/files/2117_Cal_Leg2016_Sec05_R4.pdf", [r"40 members", r"80 members", r"supreme executive power", r"elected every fourth year", r"chief law officer", r"President of the Senate", r"Superintendent of Public Instruction"]),
    ("https://www.senate.ca.gov/about", [r"40", r"four-year|four years"]),
    ("https://www.assembly.ca.gov/about-assembly", [r"80", r"two-year|two years"]),
    ("https://www.assembly.ca.gov/", [r"80 ", r"two-year|two years"]),
    ("https://www.gov.ca.gov/", [r"term|veto"]),
    ("https://oag.ca.gov/office", [r"chief law", r"ensure|enforce", r"elected"]),
    ("https://www.insurance.ca.gov/0500-about-us/", [r"Commissioner", r"Proposition 103|elected"]),
    ("https://www.treasurer.ca.gov/", [r"banker|invest|bond"]),
    ("https://www.sos.ca.gov/administration/about", [r"chief elections officer", r"business"]),
    ("https://www.cde.ca.gov/eo/in/", [r"Superintendent", r"elected|nonpartisan"]),
    ("https://www.ocsheriff.gov/about-ocsd", [r"patrol|law enforcement", r"jail", r"coroner", r"court"]),
    ("https://orangecountyda.org/about/", [r"prosecut", r"Public Administrator"]),
    ("https://www.ocassessor.gov/", [r"assess", r"value"]),
    ("https://ac.ocgov.com/", [r"Auditor-Controller", r"accounting|payroll|property tax"]),
    ("https://www.ocrecorder.com/", [r"record", r"marriage|birth"]),
    ("https://www.octreasurer.gov/", [r"tax", r"invest"]),
]


def get(url):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read(8000000), r.headers.get("content-type", "")
    except urllib.error.HTTPError as e:
        return e.code, b"", ""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}: {e}", b"", ""


def text(body, ctype):
    if "pdf" in ctype or body[:4] == b"%PDF":
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            f.write(body); f.flush()
            return re.sub(r"\s+", " ", subprocess.run(["pdftotext", f.name, "-"], capture_output=True, text=True).stdout)
    s = body.decode("utf-8", "replace")
    s = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s)))


for url, pats in PAGES:
    status, body, ctype = get(url)
    t = text(body, ctype)
    print(f"\n=== {status} {url} ({len(t)} chars)")
    for p in pats:
        hits = [m.start() for m in re.finditer(p, t, re.I)][:2]
        if not hits:
            print(f"  [{p}] NOT FOUND")
        for h in hits:
            print(f"  [{p}] ...{t[max(0, h - 300):h + 600]}...")
