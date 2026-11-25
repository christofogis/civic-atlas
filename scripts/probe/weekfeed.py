import urllib.request
u = "https://civic-atlas-cub.pages.dev/api/calendar/week?st=CA&cg=119&cd=45&su=36&sl=70&bo=4&co=ca-orange&sd=1&pl=Los%20Alamitos&pt=c&cc=1"
with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "civic-atlas probe"}), timeout=60) as r:
    body = r.read().decode(); print(r.status, r.headers.get("Content-Type"))
print(body.count("BEGIN:VEVENT"), "events")
print("\n".join(l for l in body.splitlines() if l.startswith(("SUMMARY", "DTSTART", "X-WR")))[:3000])
o = "https://civic-atlas-cub.pages.dev/api/officials?st=CA&cg=119&cd=45&su=36&sl=70&co=ca-orange&sd=1"
with urllib.request.urlopen(urllib.request.Request(o, headers={"User-Agent": "civic-atlas probe"}), timeout=60) as r:
    print("officials", r.status, len(r.read()))
