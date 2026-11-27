"""Audit: budget page figures against Treasury Fiscal Data (MTS Table 9, Debt to the Penny). Prints only."""
import json, urllib.request, urllib.parse
API = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service"
def q(path, **p):
    u = f"{API}{path}?" + urllib.parse.urlencode(p)
    return json.loads(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "civic-atlas audit probe"}), timeout=60).read())["data"]
for d in ("2023-09-30", "2024-09-30", "2025-09-30", "2026-09-30", "2026-10-31", "2025-10-31"):
    rows = q("/v1/accounting/mts/mts_table_9", filter=f"record_date:eq:{d}", **{"page[size]": "200"})
    pick = {r["line_code_nbr"]: (r["classification_desc"], r["current_fytd_rcpt_outly_amt"]) for r in rows}
    print(d, "T9 receipts(120)", pick.get("120"), "outlays(340)", pick.get("340"), "line40/50/60/70", [pick.get(k, ("-",))[0] for k in ("40", "50", "60", "70")])
    t1 = q("/v1/accounting/mts/mts_table_1", filter=f"record_date:eq:{d}", **{"page[size]": "200"})
    for r in t1:
        if "Year-to-Date" in r.get("classification_desc", ""):
            print("   T1", r)
for d in ("2026-11-23", "2025-09-30", "2026-09-30"):
    r = q("/v2/accounting/od/debt_to_penny", filter=f"record_date:eq:{d}")
    print("debt", d, [(x["tot_pub_debt_out_amt"], x["debt_held_public_amt"], x["intragov_hold_amt"]) for x in r])
print("debt latest", q("/v2/accounting/od/debt_to_penny", sort="-record_date", **{"page[size]": "1"}))
