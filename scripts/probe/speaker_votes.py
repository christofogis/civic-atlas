"""What do stored Speaker-election roll calls look like? Reads the site's public API (publishable
key, read-only) and prints each vote's question, result, totals and position tallies. Prints only."""
import json
import urllib.parse
import urllib.request
from collections import Counter

URL = "https://fkbzxaoeyrtzviyfzulq.supabase.co/rest/v1/"
KEY = "sb_publishable_M_uX1gyqB4R-7cqapPLdTQ_D4lbhVdT"


def get(path):
    req = urllib.request.Request(URL + path, headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


qs = get("votes?select=question&chamber=eq.house&question=ilike.*speaker*&limit=100")
print("questions mentioning Speaker:", Counter(q["question"] for q in qs))
votes = get("votes?select=vote_id,congress,session,roll_number,voted_at,question,vote_type,result,required,"
            "yea_total,nay_total,present_total,not_voting_total,description,source_url"
            "&question=ilike.*election*speaker*&order=voted_at")
print(len(votes), "votes")
for v in votes:
    print(json.dumps(v))
    rows = get("vote_position_details?select=position,position_category,party_at_vote&vote_id=eq." + urllib.parse.quote(v["vote_id"]) + "&limit=1000")
    print("   ", len(rows), "positions:", Counter((r["position"], r["position_category"]) for r in rows).most_common())
print("committee titles:", Counter(r["title"] for r in get("committee_memberships?select=title&title=not.is.null&limit=5000")))
print("congresses with memberships:", Counter(r["congress"] for r in get("committee_memberships?select=congress&limit=20000")))
