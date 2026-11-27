"""Explore the FEC pas2 bulk file (committee contributions to candidates) for one candidate,
to decide how to total contributions per giving committee. Prints only; writes nothing."""
import collections, io, urllib.request, zipfile

UA = {"User-Agent": "civic-atlas probe"}
CAND = "S0DE00092"  # Coons
YR = "26"


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        print(url, "Last-Modified:", r.headers.get("Last-Modified"), "bytes:", r.headers.get("Content-Length"))
        return r.read()


def lines(url):
    z = zipfile.ZipFile(io.BytesIO(get(url)))
    print("  members:", z.namelist())
    with z.open(z.namelist()[0]) as f:
        for raw in io.TextIOWrapper(f, encoding="latin-1"):
            yield raw.rstrip("\n").split("|")


ccl = [f for f in lines(f"https://www.fec.gov/files/bulk-downloads/20{YR}/ccl{YR}.zip") if f[0] == CAND]
print("ccl rows:", ccl)
auth = {f[3] for f in ccl if f[5] in ("P", "A")}
print("authorized:", auth)

names = {}
for f in lines(f"https://www.fec.gov/files/bulk-downloads/20{YR}/cm{YR}.zip"):
    names[f[0]] = f[1]
print("committee names:", len(names))

rows, n_all = [], 0
tp_all = collections.Counter()
for f in lines(f"https://www.fec.gov/files/bulk-downloads/20{YR}/pas2{YR}.zip"):
    n_all += 1
    tp_all[f[5]] += 1
    if f[16] == CAND or f[15] in auth:
        rows.append(f)
print("pas2 rows total:", n_all, "fields in first row:", len(f), "by TP:", tp_all.most_common())
print("rows for candidate/committees:", len(rows))
c = collections.Counter((f[5], f[15] in auth, f[16] == CAND, f[19]) for f in rows)
for k, v in sorted(c.items()):
    print("  TP=%s to_auth=%s cand_match=%s memo=%r: %d" % (*k, v))
print("sample rows:")
for f in rows[:5]:
    print("  ", f)
neg = [f for f in rows if f[14].startswith("-")]
print("negative amounts:", len(neg))
for f in neg[:10]:
    print("  ", f)
memo = [f for f in rows if f[19] == "X"]
print("memo rows:", len(memo))
for f in memo[:10]:
    print("  ", f)
# Same transaction reported more than once (amendments)?
dup = collections.Counter((f[0], f[17]) for f in rows if f[17])
d = [k for k, v in dup.items() if v > 1]
print("cmte+tran_id appearing >1:", len(d))
for k in d[:8]:
    for f in rows:
        if (f[0], f[17]) == k:
            print("  ", f[0], f[1], f[2], f[4], f[13], f[14], f[17], f[18], f[21])
amnd = collections.Counter(f[1] for f in rows)
print("AMNDT_IND:", amnd)

tot = collections.defaultdict(lambda: [0.0, 0])
for f in rows:
    if f[5] in ("24K", "24Z") and f[15] in auth:
        t = tot[f[0]]
        t[0] += float(f[14] or 0)
        t[1] += 1
top = sorted(tot.items(), key=lambda kv: -kv[1][0])[:25]
print("top givers (24K/24Z to authorized committees, all rows):")
for k, (amt, n) in top:
    print("  %s %-60s %10.2f %d" % (k, names.get(k, "?"), amt, n))
for k, v in tot.items():
    nm = names.get(k, "")
    if "IN OUR HANDS" in nm.upper() or "AMERICAN ISRAEL" in nm.upper() or "AIPAC" in nm.upper():
        print("check:", k, nm, v)
print("max transaction date:", max((f[13][4:] + f[13][:4]) for f in rows if f[13]))
