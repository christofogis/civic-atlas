"""Orange County city council agendas from cities that publish through Legistar's public data feed
(webapi.legistar.com), which is meant for automated reading. Each city's next council meetings,
item by item, as the city titled them.

    python3 scripts/data/city_agendas.py      # writes public/data/local/ca-orange-city-agendas.json

Cities whose agenda sites refuse automated requests are left out rather than worked around.
"""
import json, re, sys, urllib.parse, urllib.request
from datetime import date, timedelta

# City name (as in ca-orange.json's city list) -> Legistar account.
CITIES = {
    "Costa Mesa": "costamesa",
    "Fullerton": "fullerton",
    "Huntington Beach": "huntingtonbeach",
    "Newport Beach": "newportbeach",
    "Orange": "cityoforange",
    "Westminster": "westminsterca",
}
UA = {"User-Agent": "civic-atlas data build (github.com/christofogis/civic-atlas)"}
OUT = "public/data/local/ca-orange-city-agendas.json"


def get(client, path, **q):
    url = f"https://webapi.legistar.com/v1/{client}/{path}"
    if q:
        url += "?" + urllib.parse.urlencode(q, safe="$'(), ")
    with urllib.request.urlopen(urllib.request.Request(url.replace(" ", "+"), headers=UA), timeout=60) as r:
        return json.load(r)


today = date.today()
out, problems = {}, []
for city, client in CITIES.items():
    try:
        bodies = get(client, "bodies")
        council = [b for b in bodies if re.search(r"city council", b.get("BodyName") or "", re.I)]
        if not council:
            problems.append(f"{city}: no City Council body"); continue
        ids = {b["BodyId"] for b in council}
        events = get(client, "events", **{"$filter": f"EventDate ge datetime'{today.isoformat()}' and EventDate le datetime'{(today + timedelta(days=45)).isoformat()}'", "$orderby": "EventDate"})
        meetings = []
        for e in [e for e in events if e.get("EventBodyId") in ids][:3]:
            items, heading = [], None
            raw = get(client, f"events/{e['EventId']}/eventitems", AgendaNote=1, Attachments=1) if e.get("EventAgendaFile") else []
            for it in sorted(raw, key=lambda x: int(x.get("EventItemAgendaSequence") or 0)):
                title = (it.get("EventItemTitle") or "").strip()
                if not title:
                    continue
                if not it.get("EventItemMatterFile") and not it.get("EventItemMatterAttachments"):
                    # A section heading (CONSENT CALENDAR, PUBLIC HEARINGS) or a procedural line.
                    if len(title) < 80 and title.upper() == title:
                        heading = title.title()
                    continue
                atts = [{"name": a.get("MatterAttachmentName"), "url": a.get("MatterAttachmentHyperlink")}
                        for a in (it.get("EventItemMatterAttachments") or []) if a.get("MatterAttachmentHyperlink")]
                items.append({
                    "number": (it.get("EventItemAgendaNumber") or "").strip() or None,
                    "heading": heading,
                    "title": re.sub(r"\s+", " ", title),
                    "file": it.get("EventItemMatterFile"),
                    "type": it.get("EventItemMatterType"),
                    "attachments": atts[:6],
                })
            meetings.append({
                "body": e.get("EventBodyName"),
                "date": (e.get("EventDate") or "")[:10],
                "time": e.get("EventTime"),
                "location": e.get("EventLocation"),
                "agenda_url": e.get("EventAgendaFile"),
                "meeting_url": e.get("EventInSiteURL"),
                "agenda_status": e.get("EventAgendaStatusName"),
                "items": items,
            })
        out[city] = {"source": f"https://{client}.legistar.com/Calendar.aspx", "meetings": meetings}
        print(f"{city}: {len(meetings)} meetings, items {[len(m['items']) for m in meetings]}")
    except Exception as ex:
        problems.append(f"{city}: {ex}")

for p in problems:
    print("PROBLEM", p)
if not out:
    sys.exit("no city agendas read")
json.dump({
    "built_at": today.isoformat(),
    "source": "Each city's Legistar agenda system (webapi.legistar.com)",
    "cities": out,
}, open(OUT, "w"), indent=1, ensure_ascii=False)
print(f"wrote {OUT}: {len(out)} cities")
