"""Dump every 2026 race this site would show from api.sos.ca.gov (one line of JSON per race), and list
the Statement of Vote downloads for 2024 (to learn the format) and 2026 (if posted). Prints only."""
import json, re, time, urllib.request, urllib.error

UA = {"User-Agent": "civic-atlas probe (non-commercial civic site)"}
API = "https://api.sos.ca.gov/returns/"


def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r:
            return r.status, r.headers.get("Content-Type"), r.read().decode("utf8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, None, ""
    except Exception as e:
        return "ERR " + str(e), None, ""


paths = ["governor", "lieutenant-governor", "secretary-of-state", "controller", "treasurer",
         "attorney-general", "insurance-commissioner", "superintendent-of-public-instruction",
         "ballot-measures", "us-senate", "president"]
paths += [f"board-of-equalization/district/{n}" for n in range(1, 5)]
paths += [f"us-rep/district/{n}" for n in range(1, 54)]
for p in paths:
    s, ct, b = get(API + p)
    try:
        print("RACE", p, s, json.dumps(json.loads(b), separators=(",", ":")))
    except Exception:
        print("RACE", p, s, ct, b[:200].replace("\n", " "))
    time.sleep(0.3)

for u in ["https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/general-election-nov-5-2024/statement-vote",
          "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/general-election-nov-3-2026/statement-vote",
          "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/general-election-nov-3-2026",
          "https://www.sos.ca.gov/elections/upcoming-elections/general-election-nov-3-2026",
          "https://www.sos.ca.gov/elections/upcoming-elections"]:
    s, ct, h = get(u)
    print("PAGE", u, s, len(h))
    for m in sorted(set(re.findall(r'href="([^"]+)"', h))):
        if re.search(r"sov|statement|\.xlsx?|\.csv|\.pdf|\.zip|2026|semi|results|certif", m, re.I) and "prior-elections/statewide-election-results/general-election-nov" not in m[:0]:
            print("   link:", m)
    t = re.sub(r"<[^>]+>", " ", h)
    for kw in ["certif", "Statement of Vote", "December"]:
        for m in re.finditer(kw, t):
            print("   txt:", " ".join(t[max(0, m.start() - 120): m.start() + 160].split()))
            break
