"""Which leadership_roles titles does unitedstates/congress-legislators publish, and are current
leaders (Speaker, floor leaders, whips, President pro tempore) present? Also: do the House Clerk
and senate.gov leadership pages answer an ordinary request? Prints only."""
import json
import urllib.request
from collections import Counter

UA = {"User-Agent": "civic-atlas probe (public-interest, non-commercial)"}
BASE = "https://unitedstates.github.io/congress-legislators/"


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode("utf-8", "replace")


def name(m):
    n = m["name"]
    return n.get("official_full") or f"{n.get('first')} {n.get('last')}"


for fname in ["legislators-current.json", "legislators-historical.json"]:
    _, body = get(BASE + fname)
    data = json.loads(body)
    roles = [(m, r) for m in data for r in m.get("leadership_roles", [])]
    print(f"\n== {fname}: {len(data)} members, {len(roles)} roles")
    keys = Counter(k for _, r in roles for k in r)
    print("fields:", dict(keys))
    titles = Counter((r.get("chamber"), r.get("title")) for _, r in roles)
    for (ch, t), n in sorted(titles.items(), key=lambda x: (str(x[0][0]), str(x[0][1]))):
        print(f"  {ch!s:7} {n:4}  {t}")
    if fname.startswith("legislators-current"):
        print("-- roles starting 2023 or later, or with no end:")
        for m, r in sorted(roles, key=lambda x: x[1].get("start", "")):
            if r.get("start", "") >= "2023" or not r.get("end") or r.get("end", "") >= "2025":
                print(f"  {m['id']['bioguide']} {name(m):30} {r.get('chamber')!s:7} {r.get('title')!s:40} {r.get('start')} -> {r.get('end')}")
    else:
        print("-- historical roles ending 2023 or later:")
        for m, r in roles:
            if (r.get("end") or "9999") >= "2023":
                print(f"  {m['id']['bioguide']} {name(m):30} {r.get('chamber')!s:7} {r.get('title')!s:40} {r.get('start')} -> {r.get('end')}")

for url in [
    "https://clerk.house.gov/Members/HouseLeadership",
    "https://www.house.gov/leadership",
    "https://www.senate.gov/senators/leadership.htm",
]:
    try:
        status, body = get(url)
        print(f"\n{url}: HTTP {status}, {len(body)} bytes, 'Speaker' in page: {'Speaker' in body}, 'Leader' in page: {'Leader' in body}")
    except Exception as e:  # noqa: BLE001
        print(f"\n{url}: {type(e).__name__}: {e}")
