"""Audit: sampled lobbying-report-to-bill links against LDA.gov. Prints only."""
import json, re, time, urllib.request

S = [("5454db2c-0c43-4070-8e9f-12c723f9bad5", "hr", 1410), ("82568bf8-d777-4d3a-b125-9b60d03700da", "hr", 1300),
     ("cfba1d3c-fb67-43a9-895a-7f3dc5a83491", "hr", 5), ("2129ef2e-d1f5-47d4-8585-b035060bcd0b", "s", 2224),
     ("f7f45586-c283-4b4b-a255-179f250c3f7a", "s", 4784), ("f303dddd-a464-4b2d-a2a0-9b28416a71ea", "hr", 3770),
     ("4b5cc03b-a344-44e6-a6fc-d8599125c800", "hr", 1242), ("f7fe26c0-8458-4782-be5e-0c9c907fea4d", "hr", 6585),
     ("3fe06c2b-4c0c-44bd-865c-16734c501c43", "hr", 3898), ("8a04a079-c06e-413b-bcca-4ad09509d9eb", "s", 5128),
     ("82324abd-18e0-4dfb-9350-4b913ce32487", "hr", 1459), ("2027cc1e-fc63-4239-adbb-4dbd76900739", "s", 2115)]
PRE = {"hr": r"H\.?\s?R\.?", "s": r"(?<![A-Za-z.])S\.?"}
for uuid, t, n in S:
    time.sleep(4.5)
    try:
        req = urllib.request.Request(f"https://lda.gov/api/v1/filings/{uuid}/", headers={"Accept": "application/json", "User-Agent": "civic-atlas audit probe"})
        f = json.loads(urllib.request.urlopen(req, timeout=60).read())
    except Exception as e:
        print(uuid, "error", e); continue
    print(f"\n### {uuid} {f.get('filing_type')} {f.get('filing_year')} {f.get('filing_period')} client={f['client']['name']} registrant={f['registrant']['name']} posted={f.get('dt_posted')}")
    hit = False
    for a in f.get("lobbying_activities") or []:
        d = a.get("description") or ""
        for m in re.finditer(PRE[t] + r"\s{0,2}" + str(n) + r"(?!\d)", d):
            hit = True
            print("   [%s] ...%s..." % (a.get("general_issue_code"), d[max(0, m.start() - 120): m.end() + 120].replace("\n", " ")))
    if not hit:
        print("   NOT FOUND in descriptions")
