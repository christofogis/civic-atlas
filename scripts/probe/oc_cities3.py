"""Survey round 3: San Clemente through the same Legistar reading as scripts/data/city_agendas.py,
Granicus/eSCRIBE/OnBase feeds for Irvine, Mission Viejo and Yorba Linda, CivicPlus Agenda Center
feeds, and outside hosts linked from the remaining cities' agenda pages. Prints only."""
import json, re, time, urllib.request, urllib.error, urllib.parse
from datetime import date, timedelta
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
class NoRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
def fetch(url, n=800000, data=None, headers=None, follow=True):
    req = urllib.request.Request(url, headers={**UA, **(headers or {})}, data=data)
    op = urllib.request.urlopen if follow else urllib.request.build_opener(NoRedir).open
    with op(req, timeout=25) as r:
        return r.status, r.geturl(), r.read(n).decode("utf-8", "replace")
def js(url): return json.loads(fetch(url, 8_000_000)[2])
def sq(s): return re.sub(r"\s+", " ", s)

print("=== San Clemente Legistar, upcoming council items")
today = date.today()
try:
    q = urllib.parse.urlencode({"$filter": f"EventDate ge datetime'{today}' and EventDate le datetime'{today + timedelta(days=45)}'", "$orderby": "EventDate"}, safe="$'(), ").replace(" ", "+")
    ev = js(f"https://webapi.legistar.com/v1/san-clemente/events?{q}")
    for e in ev: print("EV", e["EventId"], e.get("EventBodyName"), e.get("EventDate"), e.get("EventTime"), e.get("EventAgendaFile"), e.get("EventInSiteURL"))
    past = js("https://webapi.legistar.com/v1/san-clemente/events?$orderby=EventDate+desc&$top=1")
    for e in (ev[:1] or past):
        items = js(f"https://webapi.legistar.com/v1/san-clemente/events/{e['EventId']}/eventitems?AgendaNote=1&Attachments=1")
        kept = [i for i in items if i.get("EventItemMatterFile") or i.get("EventItemMatterAttachments")]
        print("ITEMS", e["EventId"], e.get("EventDate"), "total", len(items), "with file/attachments", len(kept))
        for i in kept[:6]: print("  IT", i.get("EventItemAgendaNumber"), i.get("EventItemMatterFile"), sq(i.get("EventItemTitle") or "")[:140], len(i.get("EventItemMatterAttachments") or []))
except Exception as e: print("ERR", e)

print("=== Anaheim CivicClerk, latest events")
try:
    d = js("https://anaheimca.api.civicclerk.com/v1/Events?$orderby=startDateTime+desc&$top=4")
    for e in d.get("value", []): print("EV", e.get("id"), e.get("eventName"), e.get("startDateTime"), e.get("categoryName"))
except Exception as e: print("ERR", e)

print("=== CivicClerk sample (Fountain Valley council, items)")
try:
    m = js("https://fountainvalleyca.api.civicclerk.com/v1/Meetings/3003")
    print("MEETING KEYS", sorted(m.keys()))
    def walk(items, depth=0):
        for it in items[:10]:
            print("  " * depth + "IT", {k: sq(str(v))[:100] for k, v in it.items() if not isinstance(v, (list, dict))})
            for k, v in it.items():
                if isinstance(v, list) and v and isinstance(v[0], dict) and depth < 2:
                    print("  " * depth + " list:", k, len(v)); walk(v, depth + 1) if k.lower().startswith("child") else print("  " * depth + "  first:", sq(json.dumps(v[0]))[:300])
    walk(m.get("items") or [])
except Exception as e: print("ERR", e)

print("=== Granicus RSS")
for c, u in [("Irvine", "https://irvine.granicus.com/ViewPublisherRSS.php?view_id=68&mode=agendas"),
             ("Mission Viejo", "https://missionviejo.granicus.com/ViewPublisherRSS.php?view_id=25&mode=agendas")]:
    try:
        st, f, b = fetch(u); its = re.findall(r"<item>(.*?)</item>", b, re.S)
        print("RSS", c, st, "items", len(its))
        for i in its[:4]: print("   ", sq(re.sub(r"<[^>]+>", " | ", i))[:300])
    except Exception as e: print("RSS", c, "ERR", e)
    time.sleep(0.5)

print("=== Yorba Linda eSCRIBE")
try:
    body = json.dumps({"calendarStartDate": str(today), "calendarEndDate": str(today + timedelta(days=45))}).encode()
    st, f, b = fetch("https://pub-yorbalinda.escribemeetings.com/MeetingsCalendarView.aspx/GetCalendarMeetings", data=body, headers={"Content-Type": "application/json; charset=utf-8"})
    d = json.loads(b).get("d", [])
    print("N", len(d)); print("KEYS", sorted(d[0].keys()) if d else None)
    for m in d[:5]: print("MT", sq(json.dumps({k: m.get(k) for k in ["ID", "MeetingName", "StartDate", "Location", "HasAgenda", "MeetingDocumentLink"] if k in m}))[:400])
except urllib.error.HTTPError as e: print("HTTP", e.code)
except Exception as e: print("ERR", e)
time.sleep(0.5)

print("=== Mission Viejo OnBase Agenda Online")
try:
    st, f, b = fetch("https://dms.missionviejo.gov/OnBaseAgendaOnline/")
    print(st, f, len(b), sq(re.sub(r"<[^>]+>", " ", re.search(r"<title>(.*?)</title>", b, re.S).group(1)))[:80])
    for h in list(dict.fromkeys(re.findall(r'href="([^"]+)"', b)))[:25]: print("  ", h[:150])
except Exception as e: print("ERR", e)

print("=== CivicPlus Agenda Center feeds")
for c, base in [("Aliso Viejo", "https://avcity.org"), ("Brea", "https://www.cityofbrea.gov"), ("La Habra", "https://www.lahabraca.gov"),
                ("Laguna Niguel", "https://www.cityoflagunaniguel.org"), ("Placentia", "https://www.placentia.org"),
                ("Rancho Santa Margarita", "https://www.cityofrsm.org"), ("San Clemente", "https://www.sanclemente.gov"), ("Fountain Valley", "https://www.fountainvalley.gov")]:
    try:
        st, f, b = fetch(base + "/RSSFeed.aspx?ModID=65&CID=All-0"); its = re.findall(r"<item>(.*?)</item>", b, re.S)
        print("FEED", c, st, "items", len(its))
        for i in its[:3]: print("   ", sq(re.sub(r"<[^>]+>", " | ", i))[:260])
    except urllib.error.HTTPError as e: print("FEED", c, "HTTP", e.code)
    except Exception as e: print("FEED", c, "ERR", e)
    time.sleep(0.5)

print("=== Outside hosts on agenda pages")
PAGES = {
 "Aliso Viejo": "https://avcity.org/AgendaCenter", "Brea": "https://www.cityofbrea.gov/AgendaCenter",
 "Placentia": "https://www.placentia.org/AgendaCenter", "Rancho Santa Margarita": "https://www.cityofrsm.org/AgendaCenter",
 "Tustin": "https://www.tustinca.org/AgendaCenter", "Yorba Linda": "https://www.yorbalindaca.gov/AgendaCenter",
 "Buena Park": "https://www.buenapark.com/city_departments/city_council/council_agenda.php",
 "Garden Grove": "https://ggcity.org", "Laguna Woods": "https://www.lagunawoods.gov/current-agendas/",
 "Stanton": "https://www.stantonca.gov/government/agendas___minutes/index.php",
 "Villa Park": "https://villapark.org/Council-and-Committees/Council-Agenda-and-Minutes",
}
for c, u in PAGES.items():
    try:
        st, f, b = fetch(u)
        hosts = sorted(set(h for h in re.findall(r'(?:href|src)="https?://([^/"]+)', b, re.I)) - {urllib.parse.urlparse(f).netloc})
        ag = list(dict.fromkeys(h for h in re.findall(r'href="([^"]+)"', b) if re.search(r"agenda|council|meeting|\.pdf", h, re.I)))
        print("PAGE", c, st, "hosts:", " ".join(hosts)[:600])
        for h in ag[:10]: print("   ", h[:160])
    except urllib.error.HTTPError as e: print("PAGE", c, "HTTP", e.code)
    except Exception as e: print("PAGE", c, "ERR", e)
    time.sleep(0.5)

print("=== San Juan Capistrano redirect")
for u in ["https://sanjuancapistrano.org", "https://www.sanjuancapistrano.org/"]:
    try:
        st, f, b = fetch(u, follow=False); print(u, st, len(b))
    except urllib.error.HTTPError as e: print(u, e.code, e.headers.get("Location"))
    except Exception as e: print(u, "ERR", e)
