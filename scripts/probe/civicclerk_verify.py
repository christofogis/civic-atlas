"""Run scripts/data/city_agendas.py as the agenda job does (its output stays on the runner) and
print a few items per city with their headings; also the most recent published council agenda of
each CivicClerk city through the same parser, and which route serves a staff report. Prints only."""
import json, runpy, sys, time, urllib.request, urllib.error, urllib.parse
sys.path.insert(0, "scripts/data")
import city_agendas as ca
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
API = "https://lagunahillsca.api.civicclerk.com/v1/"
# report 1796 belongs to item 9271 of agenda 835
for u in [API + "Meetings/GetMeetingFileStream(fileId=9271,plainText=false)",
          API + "Events/GetEventFileStream(fileId=9271,fileType=1,plainText=false)",
          API + "Events/GetEventFileStream(fileId=1796,fileType=1,plainText=false)"]:
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r:
            b = r.read(); print("REPORT", r.status, r.headers.get("Content-Type"), r.headers.get("Content-Disposition"), len(b), b[:8], u)
    except urllib.error.HTTPError as e: print("REPORT HTTP", e.code, u)
    except Exception as e: print("REPORT ERR", e, u)
    time.sleep(0.5)

runpy.run_path("scripts/data/city_agendas.py", run_name="__main__")
d = json.load(open(ca.OUT))
for city, c in d["cities"].items():
    print("CITY", city, c["source"], len(c["meetings"]), "meetings")
    for m in c["meetings"]:
        print("  MT", m["date"], m["time"], m["body"], "|", m["location"], "|", m["agenda_status"], m["agenda_url"], m["meeting_url"], len(m["items"]), "items")
        for i in m["items"][:4]: print("    IT", i["number"], "|", i["heading"], "|", i["file"], "|", i["title"][:100], [a["url"] for a in i["attachments"][:1]])

print("=== latest published council agenda per CivicClerk city, same parser")
for city, t in ca.CIVICCLERK.items():
    q = urllib.parse.quote("startDateTime lt 2026-11-27T00:00:00Z", safe="")
    ev = ca.fetch_json(f"{ca.cc_api(t)}Events?$filter={q}&$orderby=startDateTime+desc&$top=25")["value"]
    ev = [e for e in ev if ca.is_council(e) and any((f.get("type") or "").lower() == "agenda" for f in e.get("publishedFiles") or [])]
    if not ev: print("PAST", city, "none"); continue
    e = ev[0]; mt = ca.civicclerk_meeting(e, t, ca.fetch_json(f"{ca.cc_api(t)}Meetings/{e['agendaId']}"))
    print("PAST", city, mt["date"], mt["time"], mt["body"], len(mt["items"]), "items", mt["agenda_url"])
    for i in mt["items"][:8]: print("    IT", i["number"], "|", i["heading"], "|", i["file"], "|", i["title"][:100], len(i["attachments"]))
    time.sleep(0.5)
