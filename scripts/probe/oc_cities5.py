"""Survey round 5: one more try (longer wait) at four CivicPlus agenda pages that timed out, and the
agenda links on San Juan Capistrano's and Laguna Woods's pages. Prints only."""
import re, time, urllib.request, urllib.error
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
PAGES = {"Brea": "https://www.cityofbrea.gov/1857/Meetings-and-Agendas", "Placentia": "https://www.placentia.org/667/Meetings-and-Agendas",
 "Rancho Santa Margarita": "https://www.cityofrsm.org/129/Agendas-Minutes", "Tustin": "https://www.tustinca.org/282/Meetings-Agendas",
 "San Juan Capistrano": "https://sanjuancapistrano.gov", "Laguna Woods": "https://www.lagunawoods.gov/city-council/city-council-meetings/"}
PAT = r"legistar|granicus|civicclerk|primegov|escribe|iqm2|novusagenda|boarddocs|laserfiche|agendalink|agendasuite|onbase|swagit|\.pdf|agenda"
for c, u in PAGES.items():
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
            b = r.read(900000).decode("utf-8", "replace"); print("PAGE", c, r.status, r.geturl(), len(b))
        for h in list(dict.fromkeys(h for h in re.findall(r'href="([^"]+)"', b) if re.search(PAT, h, re.I)))[:10]: print("   ", h[:170])
    except urllib.error.HTTPError as e: print("PAGE", c, "HTTP", e.code)
    except Exception as e: print("PAGE", c, "ERR", e)
    time.sleep(2)
