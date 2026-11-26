"""PrimeGov: print each city's latest council HTML agenda (gzip + base64) so its structure can be
studied offline. Public portal pages only; one request each. Prints only."""
import base64, gzip, time, urllib.request
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
DOCS = [("lagunabeachcity", 1116), ("lakeforest", 12219), ("lakeforest", 12225), ("santa-ana", 25719), ("sealbeach", 8537)]
for t, tid in DOCS:
    u = f"https://{t}.primegov.com/Portal/Meeting?meetingTemplateId={tid}"
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
        b = r.read()
    z = base64.b64encode(gzip.compress(b)).decode()
    print("DOC", t, tid, len(b), len(z))
    for i in range(0, len(z), 20000):
        print("B64", t, tid, z[i:i + 20000])
    time.sleep(1)
