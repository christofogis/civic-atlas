"""Which candidate names have domains free? RDAP: 404 means not registered."""
import json, urllib.request, urllib.error
names = ["vett", "vettit", "vettyourrep", "getvett", "vetthem", "plumb", "plumbit", "scrutin", "tally", "tallyit", "roster", "civicatlas", "civic-atlas"]
tlds = {"com": "https://rdap.verisign.com/com/v1/domain/", "org": "https://rdap.publicinterestregistry.org/rdap/domain/",
        "us": "https://rdap.nic.us/domain/", "app": "https://pubapi.registry.google/rdap/domain/", "vote": None}
for n in names:
    row = []
    for t, base in tlds.items():
        if not base:
            base = "https://rdap.org/domain/"
        url = base + f"{n}.{t}"
        try:
            urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/rdap+json"}), timeout=20)
            row.append(f"{t}:taken")
        except urllib.error.HTTPError as e:
            row.append(f"{t}:{'FREE' if e.code == 404 else e.code}")
        except Exception as e:
            row.append(f"{t}:err")
    print(n.ljust(14), " ".join(row))
