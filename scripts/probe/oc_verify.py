"""Run scripts/data/city_agendas.py as the agenda job does (the file it writes stays on the runner)
and print a few items per city, plus whether San Clemente's public Legistar calendar page answers."""
import json, runpy, urllib.request
runpy.run_path("scripts/data/city_agendas.py", run_name="__main__")
d = json.load(open("public/data/local/ca-orange-city-agendas.json"))
for city, c in d["cities"].items():
    print("CITY", city, c["source"], len(c["meetings"]), "meetings")
    for m in c["meetings"][:2]:
        print("  MT", m["date"], m["time"], m["body"], m["agenda_status"], m["agenda_url"], len(m["items"]), "items")
        for i in m["items"][:3]: print("    IT", i["number"], i["file"], i["title"][:110], len(i["attachments"]))
try:
    with urllib.request.urlopen(urllib.request.Request("https://san-clemente.legistar.com/Calendar.aspx", headers={"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}), timeout=30) as r:
        print("SC calendar", r.status, r.geturl())
except Exception as e: print("SC calendar ERR", e)
