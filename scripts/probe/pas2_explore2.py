"""Follow-up to pas2_explore.py: every pas2 row for a few givers to Coons, and what the memo
rows are. Prints only; writes nothing."""
import io, urllib.request, zipfile

UA = {"User-Agent": "civic-atlas probe"}
AUTH = {"C00475392"}
WATCH = {"C00797670", "C00761957"}  # AIPAC PAC, In Our Hands


def lines(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        z = zipfile.ZipFile(io.BytesIO(r.read()))
    with z.open(z.namelist()[0]) as f:
        for raw in io.TextIOWrapper(f, encoding="latin-1"):
            yield raw.rstrip("\n").split("|")


names = {f[0]: (f[1], f[9], f[8], f[14]) for f in lines("https://www.fec.gov/files/bulk-downloads/2026/cm26.zip")}
rows = [f for f in lines("https://www.fec.gov/files/bulk-downloads/2026/pas226.zip") if f[15] in AUTH]
memo_givers = {f[0] for f in rows if f[19] == "X"}
for f in rows:
    if f[0] in WATCH or f[0] in memo_givers:
        print(f[0], names.get(f[0]), "|", f[2], f[3], f[5], f[13], f[14], "memo=%r" % f[19], f[20])
# Across the whole file: what memo 24K rows say.
import collections
c = collections.Counter()
for f in lines("https://www.fec.gov/files/bulk-downloads/2026/pas226.zip"):
    if f[19] == "X":
        c[(f[5], f[20][:40])] += 1
print("memo rows in file by type/text:", c.most_common(25))
