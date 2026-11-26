"""How many members of Congress match a candidate in the committed results files by FEC candidate
ID (members.fec_candidate_ids, read with the site's public key), and which serving members don't."""
import json, re, urllib.request
cfg = open("src/lib/config.js").read()
URL = re.search(r'SUPABASE_URL = "([^"]+)"', cfg).group(1)
KEY = re.search(r'SUPABASE_PUBLISHABLE_KEY = "([^"]+)"', cfg).group(1)
def rest(path):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", headers={"apikey": KEY, "Range": "0-4999"})
    return json.load(urllib.request.urlopen(req, timeout=60))
members = {m["bioguide_id"]: m for m in rest("members?select=bioguide_id,official_full_name,fec_candidate_ids")}
seats = rest("seat_holders?select=bioguide_id,chamber,state,district,seat_status")
docs = {y: json.load(open(f"public/data/results/federal-{y}.json")) for y in (2022, 2024)}
def races_of(ids, doc):
    return [(r, c) for r in doc["races"] for c in r["candidates"] if set(c["fec_ids"]) & ids]
serving = [s for s in seats if s.get("seat_status") == "serving"]
print("members", len(members), "serving seats", len(serving))
any_match = 0
for y, doc in docs.items():
    n = sum(bool(races_of(set(m["fec_candidate_ids"] or []), doc)) for m in members.values())
    print(y, "members matched in any race:", n)
for s in serving:
    m = members.get(s["bioguide_id"]) or {}
    ids = set(m.get("fec_candidate_ids") or [])
    hits = {y: races_of(ids, d) for y, d in docs.items()}
    if any(hits.values()): any_match += 1
    if not hits[2024]:
        print("NO 2024", s["bioguide_id"], m.get("official_full_name"), s["chamber"], s["state"], s.get("district"), sorted(ids), "2022:", len(hits[2022]))
    for y, h in hits.items():
        if len({(r["state"], r["office"], r["district"], r["date"], r["term"]) for r, c in h}) != len(h):
            print("DUP", y, m.get("official_full_name"))
print("serving members matched in at least one year:", any_match, "of", len(serving))
