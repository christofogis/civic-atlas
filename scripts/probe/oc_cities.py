"""Survey: how each Orange County city publishes council agendas. Round 1: each city's home page
(one request; links to agenda vendors) and likely account names on public agenda APIs. Prints only.
Los Alamitos's own website refuses automated requests, so it is not requested here."""
import json, re, time, urllib.request, urllib.error
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
SITES = {
 "Aliso Viejo": ["https://avcity.org", "https://www.cityofalisoviejo.com"],
 "Anaheim": ["https://www.anaheim.net"],
 "Brea": ["https://www.cityofbrea.gov", "https://www.ci.brea.ca.us"],
 "Buena Park": ["https://www.buenapark.com"],
 "Cypress": ["https://www.cypressca.org"],
 "Dana Point": ["https://www.danapoint.org"],
 "Fountain Valley": ["https://www.fountainvalley.gov", "https://www.fountainvalley.org"],
 "Garden Grove": ["https://ggcity.org"],
 "Irvine": ["https://www.cityofirvine.org"],
 "La Habra": ["https://www.lahabraca.gov", "https://www.lahabracity.com"],
 "La Palma": ["https://www.lapalmaca.gov", "https://www.cityoflapalma.org"],
 "Laguna Beach": ["https://www.lagunabeachcity.net"],
 "Laguna Hills": ["https://www.lagunahillsca.gov"],
 "Laguna Niguel": ["https://www.cityoflagunaniguel.org"],
 "Laguna Woods": ["https://www.cityoflagunawoods.org"],
 "Lake Forest": ["https://www.lakeforestca.gov"],
 "Los Alamitos": [],
 "Mission Viejo": ["https://cityofmissionviejo.org"],
 "Placentia": ["https://www.placentia.org"],
 "Rancho Santa Margarita": ["https://www.cityofrsm.org"],
 "San Clemente": ["https://www.san-clemente.org"],
 "San Juan Capistrano": ["https://sanjuancapistrano.org"],
 "Santa Ana": ["https://www.santa-ana.org"],
 "Seal Beach": ["https://www.sealbeachca.gov"],
 "Stanton": ["https://www.stantonca.gov", "https://www.ci.stanton.ca.us"],
 "Tustin": ["https://www.tustinca.org"],
 "Villa Park": ["https://villapark.org"],
 "Yorba Linda": ["https://www.yorbalindaca.gov"],
}
VEND = r"legistar|granicus|civicclerk|primegov|escribe|iqm2|novusagenda|boarddocs|laserfiche|AgendaCenter|agendasuite|municode|civicweb|destinyhosted|swagit|ompnetwork"

def fetch(url, n=400000):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status, r.geturl(), r.read(n).decode("utf-8", "replace")

def slugs(city):
    a = re.sub(r"[^a-z]", "", city.lower()); h = city.lower().replace(" ", "-")
    s = [a, "cityof" + a, a + "ca", h, "ci-" + h + "-ca", a + "city"]
    return list(dict.fromkeys(s))

for city, urls in SITES.items():
    print(f"\n#### {city}")
    for u in urls:
        try:
            st, final, body = fetch(u)
            hits = sorted(set(m.group(0) for m in re.finditer(r'href="([^"]*(?:%s)[^"]*)"' % VEND, body, re.I)))
            agendas = sorted(set(m.group(1) for m in re.finditer(r'href="([^"]+)"[^>]*>[^<]{0,40}(?:Agenda|Meeting)', body, re.I)))
            print("SITE", st, final, "len", len(body))
            for h in hits[:10]: print("  VEND", h[:200])
            for h in agendas[:8]: print("  AGLINK", h[:200])
            break
        except urllib.error.HTTPError as e:
            print("SITE HTTP", e.code, u)
        except Exception as e:
            print("SITE ERR", u, str(e)[:120])
        time.sleep(0.5)
    for s in slugs(city):
        for name, url in [("legistar", f"https://webapi.legistar.com/v1/{s}/bodies"),
                          ("civicclerk", f"https://{s}.api.civicclerk.com/v1/Events?$top=2"),
                          ("primegov", f"https://{s}.primegov.com/api/v2/PublicPortal/ListUpcomingMeetings")]:
            try:
                st, final, body = fetch(url, 3000)
                if body.lstrip()[:1] in "[{":
                    print("API", name, s, st, body[:300].replace("\n", " "))
            except urllib.error.HTTPError as e:
                if e.code not in (400, 404, 500): print("APIHTTP", name, s, e.code)
            except Exception:
                pass
            time.sleep(0.2)
