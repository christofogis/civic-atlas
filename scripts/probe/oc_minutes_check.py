"""Run scripts/data/oc_minutes.py's parser on recent minutes and compare regular meetings with the
committed output, to check that a parser change reads them the same. Prints only."""
import json, sys
sys.path.insert(0, "scripts/data")
import oc_minutes as o
ag = json.load(open(o.AGENDAS))
old = {m["date"] + m.get("time", ""): m for m in json.load(open(o.OUT))["meetings"]}
for p in ag["previous"][:o.KEEP]:
    if not p.get("minutes_url"):
        continue
    special = "special" in p["title"].lower()
    items = o.parse(o.get(p["minutes_url"]))
    key = p["date"] + p["time"]
    print("==", p["date"], p["title"], len(items), "items; usable:", o.usable(items, special))
    if key in old:
        a, b = old[key]["items"], items
        print("   same as committed:", a == b)
        if a != b:
            oa = {i["number"]: i for i in a}
            for i in b:
                o_ = oa.get(i["number"])
                if o_ != i:
                    print("   ITEM", i["number"])
                    if o_ and o_["text"] != i["text"]:
                        print("     text OLD", o_["text"][-300:]); print("     text NEW", i["text"][-300:])
                    oa_ = o_["actions"] if o_ else []
                    for k in range(max(len(oa_), len(i["actions"]))):
                        x = oa_[k] if k < len(oa_) else None
                        y = i["actions"][k] if k < len(i["actions"]) else None
                        if x == y: continue
                        for f in ("motion", "votes", "notes", "vote_in_text"):
                            if (x or {}).get(f) != (y or {}).get(f):
                                print("     action", k, f, "OLD", json.dumps((x or {}).get(f))[-300:])
                                print("     action", k, f, "NEW", json.dumps((y or {}).get(f))[-300:])
            print("   numbers only in old:", sorted(set(oa) - {i["number"] for i in b}))
    else:
        print(json.dumps(items, indent=1, ensure_ascii=False)[:4000])
