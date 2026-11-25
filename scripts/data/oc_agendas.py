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
    for pat in [r"ocagendaext[^\"' <]*", r"<iframe[^>]+>", r"granicus[^\"' <]*", r"legistar[^\"' <]*", r"primegov[^\"' <]*", r"\.json[^\"' <]*", r"api/[^\"' <]*"]:
        for m in sorted(set(re.findall(pat, html, re.I)))[:15]: print("FOUND", pat[:12], m[:200])
    # Context around the first agenda link
    m = re.search(r"ExtDocViewer", html)
    if m: print("CONTEXT", re.sub(r"\s+", " ", html[max(0, m.start() - 1500):m.start() + 500]))
    sys.exit(0)
