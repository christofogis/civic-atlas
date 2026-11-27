"""Run the Issues page's three queries against the public REST API and print status, count and timing."""
import time, urllib.request, urllib.parse
URL = "https://fkbzxaoeyrtzviyfzulq.supabase.co/rest/v1/"
KEY = "sb_publishable_M_uX1gyqB4R-7cqapPLdTQ_D4lbhVdT"
since = "2026-10-27"
steps = ["reported_date","passed_house_date","failed_house_date","passed_senate_date","failed_senate_date","presented_date","vetoed_date","became_law_date"]
qs = {
 "moved": "bills?select=congress,bill_type,number,latest_action_date&congress=in.(119)&policy_area=in.(\"Education\")&latest_action_date=gte."+since+"&or=("+",".join(f"{c}.gte.{since}" for c in steps)+")&order=latest_action_date.desc&limit=5",
 "laws": "bills?select=number&congress=in.(119)&policy_area=in.(\"Education\")&became_law_date=gte."+since,
 "votes": "vote_list?select=*&congress=in.(119)&policy_area=in.(\"Education\")&voted_at=gte."+since+"&order=voted_at.desc&limit=5",
}
for name, q in qs.items():
    req = urllib.request.Request(URL + urllib.parse.quote(q, safe="?=&(),.\"*"), headers={"apikey": KEY, "Prefer": "count=exact"})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(name, r.status, r.headers.get("Content-Range"), f"{time.time()-t:.2f}s")
    except urllib.error.HTTPError as e:
        print(name, e.code, e.read()[:300], f"{time.time()-t:.2f}s")
