"""Domain availability for .org candidates via several RDAP endpoints (404 = not registered)."""
import urllib.request, urllib.error
names = ["vett", "vettit", "vettyourrep", "getvett", "vetthem", "plumbit", "scrutin", "civicatlas", "vettrecord", "vettvote", "vettedvote"]
bases = ["https://rdap.publicinterestregistry.net/rdap/domain/", "https://rdap.org/domain/"]
for n in names:
    out = []
    for b in bases:
        try:
            urllib.request.urlopen(urllib.request.Request(b + n + ".org", headers={"Accept": "application/rdap+json", "User-Agent": "Mozilla/5.0"}), timeout=20)
            out.append("taken")
        except urllib.error.HTTPError as e:
            out.append("FREE" if e.code == 404 else str(e.code))
        except Exception as e:
            out.append("err")
    print(f"{n}.org".ljust(18), *out)
for n in ["vettrecord", "vettvote", "vettedvote"]:
    try:
        urllib.request.urlopen("https://rdap.verisign.com/com/v1/domain/" + n + ".com", timeout=20); print(n + ".com taken")
    except urllib.error.HTTPError as e:
        print(n + ".com", "FREE" if e.code == 404 else e.code)
