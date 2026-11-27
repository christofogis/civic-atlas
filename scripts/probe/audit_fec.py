"""Audit: FEC figures for a sample of members, from FEC bulk files (no key) and OpenFEC (DEMO_KEY).
Prints only; writes nothing."""
import csv, io, json, time, urllib.request, urllib.error, zipfile

UA = {"User-Agent": "civic-atlas audit probe"}
IDS = ["H0CA03078","H4AZ03109","H8MA07032","H2LA02149","H8WA08189","H4VA08224","H0WI05113","S8MI00372","H2MI10150",
       "H2TN05446","H8PA05071","H0FL13158","H0NY11078","S4MD00327","S4HI00136","S0CT00177","S0DE00092","S4AZ00139",
       "S2WI00219","S8ID00027","S4MT00183","S8ND00120","S4LA00065","S2TX00106","S8ID00092"]
COLS = "CAND_ID CAND_NAME CAND_ICI PTY_CD PTY TTL_RECEIPTS TRANS_FROM_AUTH TTL_DISB TRANS_TO_AUTH COH_BOP COH_COP CAND_CONTRIB CAND_LOANS OTHER_LOANS CAND_LOAN_REPAY OTHER_LOAN_REPAY DEBTS_OWED_BY TTL_INDIV_CONTRIB ST DIST SPEC PRIM RUN GEN GENPCT OTHER_POL_CMTE_CONTRIB POL_PTY_CONTRIB CVG_END_DT INDIV_REFUNDS CMTE_REFUNDS".split()

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()

for yr in ("26", "24"):
    try:
        z = zipfile.ZipFile(io.BytesIO(get(f"https://www.fec.gov/files/bulk-downloads/20{yr}/weball{yr}.zip")))
        txt = z.read(z.namelist()[0]).decode("latin-1")
        for line in txt.splitlines():
            f = line.split("|")
            if f[0] in IDS:
                d = dict(zip(COLS, f))
                print(f"BULK20{yr}", d["CAND_ID"], "rec", d["TTL_RECEIPTS"], "disb", d["TTL_DISB"], "coh", d["COH_COP"],
                      "indiv", d["TTL_INDIV_CONTRIB"], "pac", d["OTHER_POL_CMTE_CONTRIB"], "party", d["POL_PTY_CONTRIB"],
                      "cand", d["CAND_CONTRIB"], "debt", d["DEBTS_OWED_BY"], "end", d["CVG_END_DT"])
    except Exception as e:
        print("bulk", yr, "error", e)

API = "https://api.open.fec.gov/v1"
def api(path, **p):
    p["api_key"] = "DEMO_KEY"
    url = f"{API}{path}?" + urllib.parse.urlencode(p)
    for i in range(2):
        try:
            return json.loads(get(url))
        except urllib.error.HTTPError as e:
            print("  api", e.code, path)
            if e.code == 429: return None
            time.sleep(3)
    return None
import urllib.parse

for cid in ["S0DE00092", "H0FL13158", "H8WA08189", "S2TX00106"]:
    print("\n=== API", cid)
    t = api(f"/candidate/{cid}/totals/", cycle=2026, election_full="false")
    for r in (t or {}).get("results", [])[:1]:
        print("totals", {k: r.get(k) for k in ["cycle","receipts","disbursements","last_cash_on_hand_end_period","individual_contributions","other_political_committee_contributions","coverage_end_date","individual_unitemized_contributions","individual_itemized_contributions"]})
    s = api("/schedules/schedule_a/by_size/by_candidate/", candidate_id=cid, cycle=2026, election_full="false", per_page=20)
    print("by_size", [(r["size"], r["total"]) for r in (s or {}).get("results", [])])
    st = api("/schedules/schedule_a/by_state/by_candidate/", candidate_id=cid, cycle=2026, election_full="false", per_page=100)
    rows = (st or {}).get("results", [])
    tot = sum(r["total"] or 0 for r in rows)
    home = cid[2:4]
    print("by_state total", round(tot, 2), "home", home, round(sum(r["total"] or 0 for r in rows if r["state"] == home), 2))
    c = api(f"/candidate/{cid}/committees/", cycle=2026, designation="P", per_page=5)
    cm = ((c or {}).get("results") or [{}])[0].get("committee_id")
    print("principal", cm)
    if cm:
        e = api("/schedules/schedule_a/by_employer/", committee_id=cm, cycle=2026, sort="-total", per_page=8)
        print("employers", [(r["employer"], r["total"], r["count"]) for r in (e or {}).get("results", [])])
    ie = api("/schedules/schedule_e/by_candidate/", candidate_id=cid, cycle=2026, election_full="false", per_page=100)
    rs = (ie or {}).get("results", [])
    print("IE support", round(sum(r["total"] for r in rs if r["support_oppose_indicator"] == "S"), 2),
          "oppose", round(sum(r["total"] for r in rs if r["support_oppose_indicator"] == "O"), 2), "n", len(rs))
    if cid == "S0DE00092" and cm:
        # Every line 11C receipt, paged, to compare a full ranking with the site's top 15.
        sums, n, last = {}, 0, {}
        for page in range(8):
            a = api("/schedules/schedule_a/", committee_id=cm, two_year_transaction_period=2026, line_number="F3-11C",
                    sort="-contribution_receipt_amount", per_page=100, **last)
            if not a: break
            for r in a["results"]:
                k = r.get("contributor_committee_id") or r.get("contributor_name")
                sums[k] = sums.get(k, 0) + (r["contribution_receipt_amount"] or 0); n += 1
            li = a.get("pagination", {}).get("last_indexes")
            if not li or not a["results"]: break
            last = {"last_index": li["last_index"], "last_contribution_receipt_amount": li["last_contribution_receipt_amount"]}
        top = sorted(sums.items(), key=lambda kv: -kv[1])
        print("11C rows", n, "committees", len(sums), "sum", round(sum(sums.values()), 2))
        print("top 20", top[:20])
        print("count at max", sum(1 for _, v in top if top and v == top[0][1]))
