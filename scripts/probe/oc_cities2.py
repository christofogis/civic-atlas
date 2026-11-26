"""Survey round 2: confirm the agenda APIs found in round 1 carry current meetings (with a sample),
read each remaining city's agendas page once for vendor links, and try more account names.
Los Alamitos's own website is not requested (it refuses automated requests); only CivicClerk's API."""
import json, re, time, urllib.request, urllib.error, urllib.parse
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
def fetch(url, n=600000):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
        return r.status, r.geturl(), r.read(n).decode("utf-8", "replace")
def js(url):
    return json.loads(fetch(url, 5_000_000)[2])
def show(label, url, n=700):
    try:
        st, f, b = fetch(url, 200000); print(label, st, f, "|", re.sub(r"\s+", " ", b[:n]))
    except urllib.error.HTTPError as e: print(label, "HTTP", e.code, url)
    except Exception as e: print(label, "ERR", url, str(e)[:100])
    time.sleep(0.4)

print("=== Legistar san-clemente")
try:
    ev = js("https://webapi.legistar.com/v1/san-clemente/events?$orderby=EventDate+desc&$top=3")
    for e in ev: print("EV", e.get("EventBodyName"), e.get("EventDate"), e.get("EventAgendaFile"))
except Exception as e: print("ERR", e)

print("=== CivicClerk")
for t in ["anaheimca", "fountainvalleyca", "lapalmaca", "lagunahillsca", "losalamitosca"]:
    try:
        q = urllib.parse.quote("startDateTime ge 2026-11-20T00:00:00Z", safe="")
        d = js(f"https://{t}.api.civicclerk.com/v1/Events?$filter={q}&$orderby=startDateTime&$top=6")
        for e in d.get("value", []):
            print("EV", t, e.get("id"), e.get("eventName"), e.get("startDateTime"), "agendaId", e.get("agendaId"),
                  "cat", e.get("categoryName"), "files", [(f.get("type"), f.get("name")) for f in (e.get("publishedFiles") or [])][:3])
        if t == "anaheimca" and d.get("value"):
            print("KEYS", sorted(d["value"][0].keys()))
            aid = next((e.get("agendaId") for e in d["value"] if e.get("agendaId")), None)
            if aid:
                m = js(f"https://{t}.api.civicclerk.com/v1/Meetings/{aid}")
                print("MEETING KEYS", sorted(m.keys()))
                items = m.get("items") or []
                print("N items", len(items))
                for it in items[:8]:
                    print("IT", {k: (str(v)[:120] if not isinstance(v, (list, dict)) else f"<{type(v).__name__} {len(v)}>") for k, v in it.items()})
                    for c in (it.get("childItems") or [])[:3]:
                        print("   CH", {k: (str(v)[:120] if not isinstance(v, (list, dict)) else f"<{type(v).__name__} {len(v)}>") for k, v in c.items()})
    except Exception as e: print("ERR", t, e)
    time.sleep(0.5)

print("=== PrimeGov")
for t in ["lagunabeachcity", "lakeforest", "santa-ana", "sealbeach"]:
    try:
        d = js(f"https://{t}.primegov.com/api/v2/PublicPortal/ListUpcomingMeetings")
        for m in d[:6]:
            print("MT", t, m.get("id"), m.get("title"), m.get("dateTime"), [(x.get("templateName"), x.get("compileOutputType")) for x in m.get("documentList", [])][:4])
        if t == "lakeforest" and d:
            print("KEYS", sorted(d[0].keys())); print("DOC", json.dumps(d[0].get("documentList", [])[:1])[:600])
    except Exception as e: print("ERR", t, e)
    time.sleep(0.5)

print("=== Agenda pages")
PAGES = {
 "Aliso Viejo": "https://avcity.org/AgendaCenter",
 "Brea": "https://www.cityofbrea.gov/AgendaCenter",
 "Buena Park": "https://www.buenapark.com/city_departments/city_council/council_agenda.php",
 "Dana Point": "https://www.danapoint.org/City-Government/City-Council/Meetings-Agendas-Minutes",
 "Garden Grove": "https://ggcity.org/city-clerk/agendas",
 "Irvine": "https://cityofirvine.gov/government/city-council/city-council-agendas",
 "La Habra": "https://www.lahabraca.gov/AgendaCenter",
 "Laguna Niguel": "https://www.cityoflagunaniguel.org/agendacenter",
 "Laguna Woods": "https://www.lagunawoods.gov/current-agendas/",
 "Mission Viejo": "https://www.missionviejo.gov/departments/agenda-minutes-videos",
 "Placentia": "https://www.placentia.org/AgendaCenter",
 "Rancho Santa Margarita": "https://www.cityofrsm.org/AgendaCenter",
 "San Clemente": "https://www.sanclemente.gov/AgendaCenter",
 "San Juan Capistrano": "https://www.sanjuancapistrano.org",
 "Stanton": "https://www.stantonca.gov/government/agendas___minutes/index.php",
 "Tustin": "https://www.tustinca.org/AgendaCenter",
 "Villa Park": "https://villapark.org/Council-and-Committees/Council-Agenda-and-Minutes",
 "Yorba Linda": "https://www.yorbalindaca.gov/AgendaCenter",
 "Garden Grove home": "https://ggcity.org",
}
VEND = r"legistar|granicus|civicclerk|primegov|escribe|iqm2|novusagenda|boarddocs|laserfiche|AgendaCenter/ViewFile|RSSFeed|agendasuite|OnBase|destinyhosted|swagit|\.pdf"
for city, u in PAGES.items():
    try:
        st, f, b = fetch(u)
        hits = list(dict.fromkeys(m.group(1) for m in re.finditer(r'(?:href|src)="([^"]*(?:%s)[^"]*)"' % VEND, b, re.I)))
        print("PAGE", city, st, f, len(b), "|", re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.search(r"<title>(.*?)</title>", b, re.S|re.I).group(1) if re.search(r"<title>", b, re.I) else ""))[:80])
        for h in hits[:10]: print("   ", h[:180])
    except urllib.error.HTTPError as e: print("PAGE", city, "HTTP", e.code, u)
    except Exception as e: print("PAGE", city, "ERR", str(e)[:100])
    time.sleep(0.5)

print("=== RSS (CivicPlus AgendaCenter feed)")
for city, base in [("Yorba Linda", "https://www.yorbalindaca.gov"), ("Laguna Niguel", "https://www.cityoflagunaniguel.org"), ("San Clemente", "https://www.sanclemente.gov"), ("Tustin", "https://www.tustinca.org")]:
    show("RSS " + city, base + "/RSSFeed.aspx?ModID=65&CID=All-0", 500)

print("=== more account names")
MORE = {"Aliso Viejo": ["alisoviejo", "avcity", "alisoviejoca", "cityofalisoviejo"], "Brea": ["brea", "breaca", "cityofbrea"],
 "Buena Park": ["buenapark", "buenaparkca"], "Cypress": ["cypress", "cypressca", "cityofcypress"], "Dana Point": ["danapoint", "danapointca"],
 "Garden Grove": ["gardengrove", "gardengroveca", "ggcity"], "Irvine": ["irvine", "irvineca", "cityofirvine"], "La Habra": ["lahabra", "lahabraca"],
 "Laguna Niguel": ["lagunaniguel", "lagunaniguelca"], "Laguna Woods": ["lagunawoods", "lagunawoodsca"], "Mission Viejo": ["missionviejo", "missionviejoca"],
 "Placentia": ["placentia", "placentiaca"], "Rancho Santa Margarita": ["rsm", "cityofrsm", "ranchosantamargarita", "rsmca"],
 "San Juan Capistrano": ["sanjuancapistrano", "sjc", "sjcapistrano", "sanjuancapistranoca"], "Stanton": ["stanton", "stantonca"],
 "Tustin": ["tustin", "tustinca"], "Villa Park": ["villapark", "villaparkca"], "Yorba Linda": ["yorbalinda", "yorbalindaca"],
 "San Clemente": ["sanclemente", "sanclementeca", "san-clemente"], "Garden Grove2": ["garden-grove"], "Aliso2": ["aliso-viejo"]}
for city, ss in MORE.items():
    for s in ss:
        for name, url in [("legistar", f"https://webapi.legistar.com/v1/{s}/bodies"),
                          ("civicclerk", f"https://{s}.api.civicclerk.com/v1/Events?$top=1"),
                          ("primegov", f"https://{s}.primegov.com/api/v2/PublicPortal/ListUpcomingMeetings"),
                          ("granicus", f"https://{s}.granicus.com/ViewPublisher.php?view_id=1"),
                          ("escribe", f"https://pub-{s}.escribemeetings.com/"),
                          ("iqm2", f"https://{s}.iqm2.com/Citizens/Default.aspx")]:
            try:
                st, f, b = fetch(url, 4000)
                if name in ("legistar", "civicclerk", "primegov") and b.lstrip()[:1] not in "[{": continue
                if name == "granicus" and "granicus" not in f: continue
                print("HIT", city, name, s, st, f, "|", re.sub(r"\s+", " ", b[:200]))
            except urllib.error.HTTPError as e:
                if e.code not in (400, 404, 500, 403) or name in ("granicus", "escribe", "iqm2") and e.code not in (404,): print("HTTP", city, name, s, e.code)
            except Exception: pass
            time.sleep(0.15)
