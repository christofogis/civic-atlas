"""Print the FEC results workbooks as gzipped JSON rows in base64 (smaller than the raw files, which
were cut short in the job log), plus the Clerk's 2022 statistics PDF gzipped, for offline work."""
import base64, gzip, io, json, sys, urllib.request
sys.path.insert(0, "scripts/data")
from xlsx_rows import sheets
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()
def dump(name, b):
    s = base64.b64encode(gzip.compress(b, 9)).decode()
    print("BEGIN", name, len(s))
    for i in range(0, len(s), 76): print(s[i:i + 76])
    print("END", name)
wb = sheets(io.BytesIO(get("https://www.fec.gov/documents/5676/federalelections2022.xlsx")))
keep = {k: v for k, v in wb.items() if k.startswith(("7.", "8.", "11."))}
dump("fe2022.json", json.dumps(keep).encode())
dump("ge2024cands.json", json.dumps(sheets(io.BytesIO(get("https://www.fec.gov/documents/5548/2024congressgecands.xlsx")))).encode())
dump("clerk2022.pdf", get("https://clerk.house.gov/member_info/electionInfo/2022/statistics2022.pdf"))
