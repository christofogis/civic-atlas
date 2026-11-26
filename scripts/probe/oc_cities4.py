"""Survey round 4: a CivicClerk agenda with its items, San Clemente's next Legistar meetings, and
the vendor behind the remaining cities' council agenda pages (one request each). Prints only."""
import json, re, time, urllib.request, urllib.error, urllib.parse
from datetime import date
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
def fetch(url, n=800000):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
        return r.status, r.geturl(), r.read(n).decode("utf-8", "replace")
def js(url): return json.loads(fetch(url, 8_000_000)[2])
def sq(s): return re.sub(r"\s+", " ", s)

print("=== San Clemente next events (any date)")
try:
    for e in js(f"https://webapi.legistar.com/v1/san-clemente/events?$filter=EventDate+ge+datetime'{date.today()}'&$orderby=EventDate&$top=5"):
        print("EV", e["EventId"], e.get("EventBodyName"), e.get("EventDate"), e.get("EventAgendaFile"))
except Exception as e: print("ERR", e)

print("=== CivicClerk agenda items (Laguna Hills, latest published council agenda)")
try:
    q = urllib.parse.quote("startDateTime lt 2026-11-26T00:00:00Z and agendaId gt 0", safe="")
    ev = js(f"https://lagunahillsca.api.civicclerk.com/v1/Events?$filter={q}&$orderby=startDateTime+desc&$top=8").get("value", [])
    ev = [e for e in ev if "Council" in (e.get("eventName") or "")] or ev
    e = ev[0]; print("EVENT", sq(json.dumps({k: e.get(k) for k in ["id", "eventName", "startDateTime", "agendaId", "categoryName", "eventLocation", "publishedFiles"]}))[:900])
    m = js(f"https://lagunahillsca.api.civicclerk.com/v1/Meetings/{e['agendaId']}")
    items = m.get("items") or []
    print("N top items", len(items))
    def walk(xs, d=0):
        for it in xs[:8]:
            print("  " * d + "IT", sq(json.dumps({k: v for k, v in it.items() if not isinstance(v, (list, dict))}))[:330])
            for k, v in it.items():
                if isinstance(v, list) and v:
                    print("  " * d + "  [" + k + f"] {len(v)}")
                    if d < 1 and isinstance(v[0], dict): walk(v, d + 1)
    walk(items)
except Exception as ex: print("ERR", ex)

print("=== Council agenda pages")
PAGES = {
 "Aliso Viejo": "https://avcity.org/129/Agendas-Minutes", "Brea": "https://www.cityofbrea.gov/1857/Meetings-and-Agendas",
 "Placentia": "https://www.placentia.org/667/Meetings-and-Agendas", "Rancho Santa Margarita": "https://www.cityofrsm.org/129/Agendas-Minutes",
 "Tustin": "https://www.tustinca.org/282/Meetings-Agendas", "Yorba Linda": "https://www.yorbalindaca.gov/197/Council-Meeting-Agendas",
 "Buena Park": "https://www.buenapark.com/city_departments/city_council/council_agenda.php",
 "Garden Grove": "https://ggcity.org/city-council/agenda-video", "Laguna Woods": "https://www.lagunawoods.gov/city-council/city-council-meetings/",
 "Stanton": "https://www.stantonca.gov/government/agendas___minutes/city_council.php", "San Juan Capistrano": "https://sanjuancapistrano.gov",
}
PAT = r"legistar|granicus|civicclerk|primegov|escribe|iqm2|novusagenda|boarddocs|laserfiche|agendalink|onbase|municodemeetings|meetings\.|swagit|\.pdf"
for c, u in PAGES.items():
    try:
        st, f, b = fetch(u)
        hits = list(dict.fromkeys(h for h in re.findall(r'(?:href|src)="([^"]+)"', b) if re.search(PAT, h, re.I)))
        print("PAGE", c, st, f, len(b))
        for h in hits[:8]: print("   ", h[:170])
        if c == "Buena Park":
            for m in re.finditer(r"agendalink[^\"'<>\s]*", b): print("   AL", m.group(0)[:150])
    except urllib.error.HTTPError as e: print("PAGE", c, "HTTP", e.code)
    except Exception as e: print("PAGE", c, "ERR", e)
    time.sleep(0.6)
