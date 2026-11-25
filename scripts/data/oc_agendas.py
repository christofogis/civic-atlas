"""Orange County Board of Supervisors agendas: upcoming and recent meetings, item by item, in the
county's own wording. Reads the Clerk of the Board's agenda page (board.oc.gov/meetings-agendas),
downloads each agenda PDF from ocagendaext.oc.gov, and splits it into numbered items with their
department, description, districts and file links.

    python3 scripts/data/oc_agendas.py      # writes public/data/local/ca-orange-agendas.json

Probe mode (no file written): python3 scripts/data/oc_agendas.py --probe
"""
import json, re, subprocess, sys, tempfile, urllib.request
from datetime import date

PAGE = "https://board.oc.gov/meetings-agendas"
UA = {"User-Agent": "civic-atlas data build (github.com/christofogis/civic-atlas)"}
probe = "--probe" in sys.argv

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read(), r.headers.get("Content-Type", "")

html, _ = get(PAGE)
html = html.decode("utf-8", "replace")
links = re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', html, re.S)
if probe:
    for href, text in links:
        t = re.sub(r"<[^>]+>|\s+", " ", text).strip()
        if re.search(r"agenda|ExtDocViewer|\d{1,2}/\d{1,2}/\d{2}", href + " " + t, re.I):
            print("LINK", href, "|", t[:100])
    for pat in [r"ocagendaext[^\"'<>]*", r"<iframe[^>]+>", r"granicus[^\"' <]*", r"legistar[^\"' <]*", r"primegov[^\"' <]*", r"\.json[^\"' <]*", r"api/[^\"' <]*"]:
        for m in sorted(set(re.findall(pat, html, re.I)))[:15]: print("FOUND", pat[:12], m[:200])
    for m in re.finditer(r"ocagendaext", html):
        print("CTX", re.sub(r"\s+", " ", html[max(0, m.start() - 300):m.start() + 300]))
    for src in ["https://ocagendaext.oc.gov/bosmeetingc", "https://ocagendaext.oc.gov/bosmeetingd"]:
        body, ct = get(src)
        body = body.decode("utf-8", "replace")
        print("SRC", src, ct, len(body))
        print("BODY", re.sub(r"\s+", " ", body)[:2500])
    up = get("https://ocagendaext.oc.gov/bosmeetingc")[0].decode("utf-8", "replace")
    doc = re.search(r'href="([^"]*ExtDocViewer[^"]*)"', up)
    if doc:
        u = doc.group(1) if doc.group(1).startswith("http") else "https://ocagendaext.oc.gov" + doc.group(1)
        raw, ct = get(u)
        print("DOC", u, ct, len(raw), raw[:8])
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f: f.write(raw)
        txt = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True).stdout
        i = txt.find("CONSENT CALENDAR")
        print("TEXT", txt[i:i + 9000])
        import fitz
        d = fitz.open(f.name)
        links = [l.get("uri") for pg in d for l in pg.get_links() if l.get("uri")]
        print("LINKS", len(links), links[:12])
        print("CLICK", txt.count("Click for Files"))
    sys.exit(0)
    # Context around the first agenda link
    m = re.search(r"ExtDocViewer", html)
    if m: print("CONTEXT", re.sub(r"\s+", " ", html[max(0, m.start() - 1500):m.start() + 500]))
    sys.exit(0)
