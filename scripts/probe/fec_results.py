"""Find the FEC's "Federal Elections" results publications (and their Excel files) for 2022-2026,
download each .xlsx found, and print its sheet names, header rows and a few House/Senate rows."""
import io, re, urllib.request
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.status, r.geturl(), r.read()
BASE = "https://www.fec.gov/introduction-campaign-finance/election-results-and-voting-information/"
pages = [BASE] + [BASE + f"federal-elections-{y}/" for y in (2022, 2024, 2026)]
xlsx = set()
for p in pages:
    try:
        st, final, body = get(p)
        html = body.decode("utf-8", "replace")
        links = sorted(set(re.findall(r'href="([^"]+)"', html)))
        print("PAGE", p, st, final)
        for l in links:
            if re.search(r"(federal-elections-20|\.xlsx|\.pdf|results)", l, re.I) and "googletag" not in l:
                print("   ", l)
                if l.endswith(".xlsx"): xlsx.add(l if l.startswith("http") else "https://www.fec.gov" + l)
    except Exception as e:
        print("PAGE", p, "ERR", e)
for c in ["https://clerk.house.gov/member_info/electionInfo/2024/statistics2024.pdf",
          "https://clerk.house.gov/member_info/electionInfo/2022/statistics2022.pdf",
          "https://clerk.house.gov/Members/ElectionInformation"]:
    try:
        st, final, body = get(c); print("CLERK", c, st, final, len(body))
    except Exception as e: print("CLERK", c, "ERR", e)
import subprocess, sys
subprocess.run([sys.executable, "-m", "pip", "install", "-q", "openpyxl"], check=False)
import openpyxl
for u in sorted(xlsx):
    if "pres" in u: continue
    try:
        st, final, body = get(u)
        print("XLSX", u, st, len(body))
        wb = openpyxl.load_workbook(io.BytesIO(body), read_only=True, data_only=True)
        for ws in wb.worksheets:
            print("  SHEET", repr(ws.title), ws.max_row, ws.max_column)
            if re.search(r"house|senate", ws.title, re.I):
                for i, row in enumerate(ws.iter_rows(values_only=True)):
                    if i < 40 or (row and any(isinstance(v, str) and ("Runoff" in v or "Unexpired" in v or "Combined" in v or "Total" in v) for v in row) and i < 3000):
                        print("   ", i, row)
                    if i > 3000: break
    except Exception as e: print("XLSX", u, "ERR", e)
