"""Run scripts/data/city_agendas.py as the agenda job does (its output stays on the runner), print
a few items per PrimeGov city, run the same parser on each city's latest published council agenda,
and check that the portal, agenda PDF and attachment links answer. Prints only."""
import json, re, runpy, sys, time, urllib.request, urllib.error
sys.path.insert(0, "scripts/data")
import city_agendas as ca
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
def head(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r:
            b = r.read(600); return f"{r.status} {r.headers.get('Content-Type')} {r.geturl()[:70]} {b[:12]!r}"
    except urllib.error.HTTPError as e: return f"HTTP {e.code}"
    except Exception as e: return f"ERR {e}"

runpy.run_path("scripts/data/city_agendas.py", run_name="__main__")
d = json.load(open(ca.OUT))
for city in ca.PRIMEGOV:
    c = d["cities"].get(city)
    if not c: print("MISSING", city); continue
    print("CITY", city, c["source"], len(c["meetings"]), "meetings")
    for m in c["meetings"]:
        print("  MT", m["date"], m["time"], m["body"], "|", m["location"], "|", m["agenda_status"], m["agenda_url"], m["meeting_url"], len(m["items"]), "items")
        for i in m["items"][:4]: print("    IT", i["number"], "|", i["heading"], "|", i["title"][:100], len(i["attachments"]))

print("=== latest published council agenda per city, same parser")
for city, t in ca.PRIMEGOV.items():
    base = f"https://{t}.primegov.com"
    ar = ca.fetch_json(f"{base}/api/v2/PublicPortal/ListArchivedMeetings?year=2026")
    ar = sorted([m for m in ar if ca.pg_is_council(m) and ca.pg_docs(m)[1]], key=lambda m: m.get("dateTime") or "", reverse=True)
    if not ar: print("PAST", city, "none"); continue
    m = ar[0]; _, htm = ca.pg_docs(m)
    page, final = ca.fetch_text(f"{base}/Portal/Meeting?meetingTemplateId={htm['templateId']}")
    mt = ca.primegov_meeting(m, t, page)
    print("PAST", city, mt["date"], mt["time"], mt["body"], len(mt["items"]), "items", "headings", len({i["heading"] for i in mt["items"]}))
    for i in mt["items"][:6]: print("    IT", i["number"], "|", i["heading"], "|", i["title"][:100], [a["name"] for a in i["attachments"]][:2])
    print("  LINK portal", head(c_src := f"{base}/public/portal"))
    print("  LINK agenda", head(mt["agenda_url"]) if mt["agenda_url"] else None)
    att = next((a["url"] for i in mt["items"] for a in i["attachments"]), None)
    print("  LINK attachment", att, head(att) if att else None)
    time.sleep(1)
