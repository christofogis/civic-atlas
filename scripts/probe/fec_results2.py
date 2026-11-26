"""Print the layout of the FEC's Federal Elections 2022 workbook (House and Senate sheets), the FEC's
2024 list of congressional candidates on general-election ballots, and the House Clerk's 2024
Statistics of the Congressional Election (pdftotext -layout), to write the results parser against."""
import io, re, subprocess, sys, urllib.request
sys.path.insert(0, "scripts/data")
from xlsx_rows import sheets
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()
wb = sheets(io.BytesIO(get("https://www.fec.gov/documents/5676/federalelections2022.xlsx")))
for name, rows in wb.items():
    print("SHEET", repr(name), len(rows))
for name, rows in wb.items():
    if not re.search(r"house|senate", name, re.I): continue
    print("=== SHEET", name)
    for i, r in enumerate(rows[:45]): print(i, r)
    for i, r in enumerate(rows):
        txt = " ".join(str(v) for v in r if v is not None)
        if re.search(r"\b(NY|LA|GA)\b", str(r[:3])) and i < 99999 and re.search(r"(Combined|Runoff|Total|Unexpired|Party Votes|Unopposed|W\b)", txt):
            print("Q", i, r)
    # every distinct value in non-numeric short columns, to learn the flags used
    hdr = None
    for r in rows[:15]:
        if r and any(isinstance(v, str) and "CANDIDATE" in v.upper() for v in r): hdr = r
    print("HEADER", hdr)
    if hdr:
        for j, h in enumerate(hdr):
            vals = {r[j] for r in rows if len(r) > j and isinstance(r[j], str)}
            if len(vals) < 40: print("  COL", j, h, sorted(vals)[:40])
print("=== 2024 congress GE candidates")
c = sheets(io.BytesIO(get("https://www.fec.gov/documents/5548/2024congressgecands.xlsx")))
for name, rows in c.items():
    print("SHEET", name, len(rows))
    for r in rows[:12]: print("  ", r)
    for r in rows:
        if r and re.search(r"\b(NY|LA)\b", str(r[:3])) : print("  NYLA", r); 
print("=== Clerk 2024")
open("/tmp/s.pdf", "wb").write(get("https://clerk.house.gov/member_info/electionInfo/2024/statistics2024.pdf"))
subprocess.run(["pdftotext", "-layout", "/tmp/s.pdf", "/tmp/s.txt"])
lines = open("/tmp/s.txt").read().split("\n")
print(len(lines), "lines")
for i, l in enumerate(lines[:260]): print("L", i, l)
for k in ("LOUISIANA", "NEW YORK", "GEORGIA", "FLORIDA"):
    idx = [i for i, l in enumerate(lines) if l.strip().startswith(k)]
    print("IDX", k, idx[:5])
    if idx:
        for l in lines[idx[0]: idx[0] + 70]: print("K", l)
