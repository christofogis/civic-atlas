"""Orange County city council agendas from cities that publish through an agenda system with a
public data feed meant for automated reading: Legistar (webapi.legistar.com) and CivicClerk
({tenant}.api.civicclerk.com). Each city's next council meetings, item by item, as the city titled them.

    python3 scripts/data/city_agendas.py      # writes public/data/local/ca-orange-city-agendas.json

Cities whose agenda sites refuse automated requests are left out rather than worked around.
See docs/oc-city-agendas.md for how each of the 34 cities publishes.
"""
import html, json, re, sys, urllib.parse, urllib.request
from datetime import date, timedelta

# City name (as in ca-orange.json's city list) -> Legistar account.
CITIES = {
    "Costa Mesa": "costamesa",
    "Fullerton": "fullerton",
    "Huntington Beach": "huntingtonbeach",
    "Newport Beach": "newportbeach",
    "Orange": "cityoforange",
    "San Clemente": "san-clemente",
    "Westminster": "westminsterca",
}
# City name -> CivicClerk tenant.
CIVICCLERK = {
    "Fountain Valley": "fountainvalleyca",
    "La Palma": "lapalmaca",
    "Laguna Hills": "lagunahillsca",
    # "Los Alamitos": "losalamitosca",  # pending Chris's decision on the Los Alamitos route
}
UA = {"User-Agent": "civic-atlas data build (github.com/christofogis/civic-atlas)"}
OUT = "public/data/local/ca-orange-city-agendas.json"
DAYS = 45      # how far ahead to look
PER_CITY = 3   # council meetings per city


def fetch_json(url):
    with urllib.request.urlopen(urllib.request.Request(url.replace(" ", "+"), headers=UA), timeout=60) as r:
        return json.load(r)


# ---------------------------------------------------------------- Legistar

def legistar_get(client, path, **q):
    url = f"https://webapi.legistar.com/v1/{client}/{path}"
    if q:
        url += "?" + urllib.parse.urlencode(q, safe="$'(), ")
    return fetch_json(url)


def legistar_items(raw):
    """Agenda items from Legistar eventitems: only real items (a file number or attachments).
    Short all-capitals lines without either are kept only as the heading for the items after them."""
    items, heading = [], None
    for it in sorted(raw, key=lambda x: int(x.get("EventItemAgendaSequence") or 0)):
        title = (it.get("EventItemTitle") or "").strip()
        if not title:
            continue
        if not it.get("EventItemMatterFile") and not it.get("EventItemMatterAttachments"):
            # Headings (CONSENT CALENDAR), procedure (ROLL CALL) and layout lines.
            if len(title) < 80 and title.upper() == title and re.search(r"[A-Z]{4}", title):
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
    return items


def legistar_city(client, today):
    bodies = legistar_get(client, "bodies")
    council = [b for b in bodies if re.search(r"city council", b.get("BodyName") or "", re.I)]
    if not council:
        raise RuntimeError("no City Council body")
    ids = {b["BodyId"] for b in council}
    events = legistar_get(client, "events", **{"$filter": f"EventDate ge datetime'{today.isoformat()}' and EventDate le datetime'{(today + timedelta(days=DAYS)).isoformat()}'", "$orderby": "EventDate"})
    meetings = []
    for e in [e for e in events if e.get("EventBodyId") in ids][:PER_CITY]:
        raw = legistar_get(client, f"events/{e['EventId']}/eventitems", AgendaNote=1, Attachments=1) if e.get("EventAgendaFile") else []
        meetings.append({
            "body": e.get("EventBodyName"),
            "date": (e.get("EventDate") or "")[:10],
            "time": e.get("EventTime"),
            "location": e.get("EventLocation"),
            "agenda_url": e.get("EventAgendaFile"),
            "meeting_url": e.get("EventInSiteURL"),
            "agenda_status": e.get("EventAgendaStatusName"),
            "items": legistar_items(raw),
        })
    return {"source": f"https://{client}.legistar.com/Calendar.aspx", "meetings": meetings}


# ---------------------------------------------------------------- CivicClerk

def cc_api(tenant):
    return f"https://{tenant}.api.civicclerk.com/v1/"


def cc_text(s):
    """CivicClerk item names can carry HTML markup (<span style=...>, <br>). The words stay as the
    city wrote them; only markup is removed (line and paragraph breaks become spaces) and
    whitespace collapsed."""
    s = re.sub(r"</?(?:br|p|div|li|ul|ol|tr|td|h\d)\b[^>]*>", " ", s or "", flags=re.I)
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    return re.sub(r"\s+", " ", s).strip()


def cc_label(it):
    name = cc_text(it.get("agendaObjectItemName"))
    num = (it.get("agendaObjectItemOutlineNumber") or "").strip()
    return f"{num} {name}".strip() if name else None


def civicclerk_items(meeting, tenant):
    """Agenda items from a CivicClerk Meetings/{agendaId} response. The agenda is a tree: sections
    (Consent Calendar) hold the items. Same filter as Legistar: an item is kept only if it has an
    item number (CivicClerk's file number, e.g. 2026-1192) or published attachments. An entry with
    child items and no attachments of its own is a section: it becomes the heading of the items
    under it, never an item itself, even when it carries a number."""
    items = []

    def atts_of(it):
        out = []
        for a in it.get("attachmentsList") or []:
            if a.get("isDeleted") or a.get("isPublished") is False or not a.get("id"):
                continue
            out.append({"name": cc_text(a.get("fileName")) or None,
                        "url": f"{cc_api(tenant)}Meetings/GetAttachmentFile(fileId={a['id']})"})
        return out

    def walk(entries, path):
        for it in sorted(entries, key=lambda x: x.get("sortOrder") or 0):
            if it.get("isDeleted"):
                continue
            children = [c for c in (it.get("childItems") or []) if not c.get("isDeleted")]
            atts = atts_of(it)
            file = (it.get("agendaObjectItemNumber") or "").strip() or None
            title = cc_text(it.get("agendaObjectItemName"))
            if title and (atts or (file and not children)):
                items.append({
                    "number": (it.get("agendaObjectItemOutlineNumber") or "").strip() or None,
                    "heading": " — ".join(path) or None,
                    "title": title,
                    "file": file,
                    "type": it.get("agendaObjItemCategoryTypeDesc") or None,
                    "attachments": atts[:6],
                })
            if children:
                label = cc_label(it)
                walk(children, path + [label] if label else path)

    walk(meeting.get("items") or [], [])
    return items


def cc_time(start):
    """CivicClerk gives the local meeting time with a 'Z' suffix (a 6:00 PM meeting reads
    T18:00:00Z), so the clock time is read as written, not converted."""
    m = re.match(r"\d{4}-\d\d-\d\dT(\d\d):(\d\d)", start or "")
    if not m:
        return None
    h, mi = int(m.group(1)), m.group(2)
    return f"{(h % 12) or 12}:{mi} {'AM' if h < 12 else 'PM'}"


def civicclerk_meeting(e, tenant, meeting=None):
    """One meeting in the shared output shape, from a CivicClerk event (and its agenda, if published)."""
    agenda = next((f for f in e.get("publishedFiles") or [] if (f.get("type") or "").lower() == "agenda" and f.get("fileId")), None)
    loc = e.get("eventLocation") or {}
    return {
        "body": e.get("eventName"),
        "date": (e.get("startDateTime") or "")[:10],
        "time": cc_time(e.get("startDateTime")),
        "location": ", ".join(x for x in [loc.get("address1"), loc.get("address2")] if x) or None,
        "agenda_url": f"{cc_api(tenant)}Meetings/GetMeetingFileStream(fileId={agenda['fileId']},plainText=false)" if agenda else None,
        "meeting_url": f"https://{tenant}.portal.civicclerk.com/event/{e['id']}/files",
        "agenda_status": "Published" if agenda else None,
        "items": civicclerk_items(meeting, tenant) if (agenda and meeting) else [],
    }


def is_council(e):
    return bool(re.search(r"city council", f"{e.get('categoryName') or ''} {e.get('eventName') or ''}", re.I))


def civicclerk_city(tenant, today):
    end = today + timedelta(days=DAYS + 1)
    q = urllib.parse.urlencode({"$filter": f"startDateTime ge {today.isoformat()}T00:00:00Z and startDateTime lt {end.isoformat()}T00:00:00Z",
                                "$orderby": "startDateTime"}, safe="$:'")
    events = fetch_json(f"{cc_api(tenant)}Events?{q}").get("value", [])
    meetings = []
    for e in [e for e in events if is_council(e)][:PER_CITY]:
        has_agenda = any((f.get("type") or "").lower() == "agenda" for f in e.get("publishedFiles") or [])
        meeting = fetch_json(f"{cc_api(tenant)}Meetings/{e['agendaId']}") if has_agenda and e.get("agendaId") else None
        meetings.append(civicclerk_meeting(e, tenant, meeting))
    return {"source": f"https://{tenant}.portal.civicclerk.com/", "meetings": meetings}


# ---------------------------------------------------------------- main

def main():
    today = date.today()
    out, problems = {}, []
    readers = [(c, legistar_city, a) for c, a in CITIES.items()] + [(c, civicclerk_city, t) for c, t in CIVICCLERK.items()]
    for city, read, account in sorted(readers):
        try:
            out[city] = read(account, today)
            print(f"{city}: {len(out[city]['meetings'])} meetings, items {[len(m['items']) for m in out[city]['meetings']]}")
        except Exception as ex:
            problems.append(f"{city}: {ex}")
    for p in problems:
        print("PROBLEM", p)
    if not out:
        sys.exit("no city agendas read")
    json.dump({
        "built_at": today.isoformat(),
        "source": "Each city's agenda system: Legistar (webapi.legistar.com) or CivicClerk (api.civicclerk.com)",
        "cities": out,
    }, open(OUT, "w"), indent=1, ensure_ascii=False)
    print(f"wrote {OUT}: {len(out)} cities")


if __name__ == "__main__":
    main()
