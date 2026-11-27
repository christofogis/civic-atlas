"""Availability of invented name candidates: .org via rdap.org, .com via Verisign RDAP (404 = free)."""
import urllib.request, urllib.error, time
names = """probo civio civly civiq votara civara repora recivo vettly vettr votra ballo electa civisio recorda clarimo
govly reppo repwise plainvote votable tallo civika kivic verum veri lumio sabelo polara regista voxly civix repsy docketo
ledgra votelo civvy recordly vetro civero repvet plainrep civlo clearrep voteo civicly""".split()
def check(url):
    for _ in range(3):
        try:
            urllib.request.urlopen(urllib.request.Request(url, headers={"Accept": "application/rdap+json", "User-Agent": "Mozilla/5.0"}), timeout=20)
            return "taken"
        except urllib.error.HTTPError as e:
            if e.code == 404: return "FREE"
            if e.code == 429: time.sleep(3); continue
            return str(e.code)
        except Exception:
            time.sleep(1)
    return "err"
for n in names:
    o = check(f"https://rdap.org/domain/{n}.org"); c = check(f"https://rdap.verisign.com/com/v1/domain/{n}.com")
    print(f"NAME {n.ljust(12)} org:{o:6} com:{c}"); time.sleep(0.5)
