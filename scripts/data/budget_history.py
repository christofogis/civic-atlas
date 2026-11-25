"""Federal receipts, outlays and surplus or deficit since 1940, from the Office of Management and
Budget's Historical Tables, Table 1.3 (current dollars, constant dollars, and percent of GDP).

    python3 scripts/data/budget_history.py      # writes public/data/budget-history.json

OMB publishes the tables with each President's Budget. Rows for years not yet over are OMB's
estimates; only actual years are kept. Figures are stored as published (billions of dollars,
percent of GDP), with OMB's sign: a deficit is negative.
"""
import io
import json
import re
import sys
import urllib.request
from datetime import date

PAGE = "https://www.whitehouse.gov/omb/budget/historical-tables/"
UA = {"User-Agent": "civic-atlas data build (github.com/christofogis/civic-atlas)"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


html = get(PAGE).decode("utf-8", "replace")
links = sorted(set(re.findall(r'https?://[^"\']+hist01z3[^"\']*\.xlsx?', html)))
if not links:
    sys.exit(f"no Table 1.3 spreadsheet linked from {PAGE}")
url = links[-1]
print("Table 1.3:", url)
raw = get(url)

if url.endswith(".xlsx"):
    import openpyxl
    ws = openpyxl.load_workbook(io.BytesIO(raw), data_only=True).worksheets[0]
    rows = [[c.value for c in r] for r in ws.iter_rows()]
else:
    import xlrd
    sh = xlrd.open_workbook(file_contents=raw).sheet_by_index(0)
    rows = [sh.row_values(i) for i in range(sh.nrows)]

title = next((str(c) for r in rows[:4] for c in r if c and "Table 1.3" in str(c)), "Table 1.3")
years = []
for r in rows:
    label = str(r[0]).strip() if r and r[0] is not None else ""
    if "estimate" in label.lower():
        break  # OMB's projections start here
    m = re.fullmatch(r"(\d{4})(?:\.0)?", label)
    if not m:
        continue  # headers, notes, and the 1976 transition quarter ("TQ")
    nums = [c for c in r[1:] if isinstance(c, (int, float))]
    # Receipts, outlays, surplus/deficit (current $), the same in constant $, deflator, the same as % of GDP.
    if len(nums) < 10:
        continue
    years.append({
        "fiscal_year": int(m.group(1)),
        "receipts": nums[0], "outlays": nums[1], "surplus": nums[2],
        "receipts_const": nums[3], "outlays_const": nums[4], "surplus_const": nums[5],
        "receipts_gdp": nums[7], "outlays_gdp": nums[8], "surplus_gdp": nums[9],
    })

# Sanity checks against figures that don't change: FY2000 was a surplus, FY2020 the largest deficit.
by = {y["fiscal_year"]: y for y in years}
if not years or years[0]["fiscal_year"] > 1940 or 2000 not in by or 2020 not in by:
    sys.exit(f"unexpected years: {[y['fiscal_year'] for y in years][:3]} ... {[y['fiscal_year'] for y in years][-3:]}")
if not (by[2000]["surplus"] > 0 and by[2020]["surplus"] < -2500 and abs(by[2020]["receipts"] - by[2020]["outlays"] - by[2020]["surplus"]) < 2):
    sys.exit(f"columns don't read as expected: 2000 {by[2000]}, 2020 {by[2020]}")
const_base = re.search(r"FY ?(\d{4})", " ".join(str(c) for r in rows[:6] for c in r if c))

with open("public/data/budget-history.json", "w") as f:
    json.dump({
        "built_at": date.today().isoformat(),
        "source": f"Office of Management and Budget, Historical Tables, {title.split('—')[0].strip()}",
        "source_url": url,
        "source_page": PAGE,
        "units": "billions of dollars; constant dollars are in FY" + (const_base.group(1) if const_base else "?") + " dollars; GDP shares in percent",
        "constant_year": int(const_base.group(1)) if const_base else None,
        "years": years,
    }, f, indent=0)
print(f"{len(years)} years, FY{years[0]['fiscal_year']}–FY{years[-1]['fiscal_year']}; FY{years[-1]['fiscal_year']}: {years[-1]}")
