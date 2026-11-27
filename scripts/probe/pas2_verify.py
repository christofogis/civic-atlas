"""Run scripts/probe/pas2_verify.mjs (committee-contribution totals from the FEC pas2 bulk file)
and, for comparison, the campaign's own Schedule A receipts from two givers via OpenFEC
(DEMO_KEY). Prints only; writes nothing."""
import json, subprocess, urllib.parse, urllib.request

subprocess.run(["node", "scripts/probe/pas2_verify.mjs"], check=True)

print("\nCoons committee C00475392, receipts as reported by the campaign (OpenFEC Schedule A, 2026):")
for giver in ("C00761957", "C00797670"):
    q = urllib.parse.urlencode({"api_key": "DEMO_KEY", "committee_id": "C00475392", "contributor_id": giver,
                                "two_year_transaction_period": 2026, "per_page": 50})
    try:
        with urllib.request.urlopen(f"https://api.open.fec.gov/v1/schedules/schedule_a/?{q}", timeout=60) as r:
            rows = json.load(r)["results"]
        print(" ", giver, sum(x["contribution_receipt_amount"] for x in rows),
              [(x["contribution_receipt_date"], x["contribution_receipt_amount"], x["line_number"], x.get("memo_code")) for x in rows])
    except Exception as e:
        print(" ", giver, "error", e)
