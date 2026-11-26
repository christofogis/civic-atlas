"""Find the California Secretary of State's machine-readable results for the Nov 3, 2026 general
election: the election-night site's JSON feed and the Statement of Vote downloads. Prints only."""
import json, re, urllib.request, urllib.error

UA = {"User-Agent": "civic-atlas probe (non-commercial civic site)", "Accept": "*/*"}


def get(u, n=800, show=True):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r:
            b = r.read()
            if show:
                print("==", u, r.status, r.headers.get("Content-Type"), len(b))
                print(b[:n].decode("utf8", "replace"))
            return b.decode("utf8", "replace")
    except urllib.error.HTTPError as e:
        print("==", u, "HTTP", e.code, e.read()[:300])
    except Exception as e:
        print("==", u, "ERR", e)
    return ""


home = get("https://electionresults.sos.ca.gov/", 1500)
for s in sorted(set(re.findall(r'(?:src|href)="([^"]+\.js[^"]*)"', home)))[:10]:
    url = s if s.startswith("http") else "https://electionresults.sos.ca.gov/" + s.lstrip("/")
    js = get(url, 0, show=False)
    print("JS", url, len(js))
    for m in sorted(set(re.findall(r'https?://[a-zA-Z0-9.\-]+(?:/[A-Za-z0-9_\-./{}$]*)?', js))):
        if "sos" in m or "api" in m:
            print("   url:", m)
    for m in sorted(set(re.findall(r'["\'`](/?returns/[^"\'`]{0,80})', js)))[:80]:
        print("   path:", m)

for p in ["status", "governor", "us-senate", "us-rep/district/45", "ballot-measures",
          "board-of-equalization/district/1", "superintendent-of-public-instruction",
          "state-senate/district/36", "state-assembly/district/72"]:
    get("https://api.sos.ca.gov/returns/" + p, 1500)

for u in ["https://www.sos.ca.gov/elections/prior-elections/statewide-election-results",
          "https://www.sos.ca.gov/elections/upcoming-elections/general-election-nov-3-2026",
          "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/general-election-november-3-2026"]:
    h = get(u, 0, show=True)
    for m in sorted(set(re.findall(r'href="([^"]*(?:sov|statement|2026|results|semi)[^"]*)"', h, re.I)))[:60]:
        print("   link:", m)
