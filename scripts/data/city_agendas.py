"""Orange County city council agendas from cities that publish through an agenda system meant for
public reading: Legistar (webapi.legistar.com), CivicClerk ({tenant}.api.civicclerk.com) and PrimeGov
({tenant}.primegov.com: meeting list from its public API, items from the HTML agenda its public
portal serves). Each city's next council meetings, item by item, as the city titled them.

    python3 scripts/data/city_agendas.py      # writes public/data/local/ca-orange-city-agendas.json

Cities whose agenda sites refuse automated requests are left out rather than worked around.
See docs/oc-city-agendas.md for how each of the 34 cities publishes.
"""
import html, json, re, sys, urllib.parse, urllib.request
from html.parser import HTMLParser
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
# City name -> PrimeGov tenant (the vendor's public portal, not the city website).
PRIMEGOV = {
    "Laguna Beach": "lagunabeachcity",
    "Lake Forest": "lakeforest",
    "Santa Ana": "santa-ana",
    "Seal Beach": "sealbeach",
}
UA = {"User-Agent": "civic-atlas data build (github.com/christofogis/civic-atlas)"}
OUT = "public/data/local/ca-orange-city-agendas.json"
DAYS = 45      # how far ahead to look
PER_CITY = 3   # council meetings per city


def fetch_json(url):
    with urllib.request.urlopen(urllib.request.Request(url.replace(" ", "+"), headers=UA), timeout=60) as r:
        return json.load(r)


def fetch_text(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        return r.read().decode("utf-8", "replace"), r.geturl()


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


# ---------------------------------------------------------------- PrimeGov

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
BLOCK = {"br", "p", "div", "li", "tr", "td", "table", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6"}


class Node:
    __slots__ = ("tag", "attrs", "children", "parent")

    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.children, self.parent = tag, dict(attrs), [], parent

    def classes(self):
        return (self.attrs.get("class") or "").split()

    def iter(self):
        yield self
        for c in self.children:
            if isinstance(c, Node):
                yield from c.iter()

    def find(self, pred):
        return next((n for n in self.iter() if pred(n)), None)

    def text(self, blocks=True):
        """Text with block breaks as newlines (when blocks) and entities decoded."""
        out = []

        def walk(n):
            for c in n.children:
                if isinstance(c, str):
                    out.append(c)
                else:
                    if blocks and c.tag in BLOCK:
                        out.append("\n")
                    walk(c)
                    if blocks and c.tag in BLOCK:
                        out.append("\n")
        walk(self)
        t = "".join(out).replace("\xa0", " ")
        return "\n".join(x for x in (re.sub(r"[ \t\r\f\v]+", " ", line).strip() for line in t.split("\n")) if x)


class TreeBuilder(HTMLParser):
    """Lenient tree for PrimeGov's agenda pages (stdlib only): unmatched end tags close back to the
    nearest open element of the same name, or are ignored."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", [], None)
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def pg_parse(page):
    b = TreeBuilder()
    b.feed(page)
    b.close()
    return b.root


def first_line(node):
    t = node.text() if node else ""
    return t.split("\n")[0].strip() if t else ""


def pg_heading(row):
    """A section row's heading as printed: the section letter or number, if any, and the first bold
    run of its text (the title, without the paragraph of rules that often follows it)."""
    num = row.find(lambda n: "number-cell-section" in n.classes())
    body = (row.find(lambda n: "section-heading" in n.classes())
            or row.find(lambda n: n.tag == "td" and n.attrs.get("colspan")))
    if body is None:
        return None
    bold = body.find(lambda n: n.tag in ("strong", "b") and n.text(blocks=False).strip(" *-–"))
    title = (bold.text(blocks=False) if bold else first_line(body)).strip()
    title = re.sub(r"\s+", " ", title).rstrip(" –—-:")
    if not title or len(title) > 160:
        return None
    n = re.sub(r"\s+", " ", num.text(blocks=False)).strip() if num else ""
    return f"{n} {title}".strip()


def primegov_items(page, tenant):
    """Agenda items from a PrimeGov HTML agenda (Portal/Meeting?meetingTemplateId=...). The page
    marks sections (class section-row) and items (class meeting-item, data-itemid) the same way for
    every city. PrimeGov shows no file numbers, so under the shared filter an item is kept only if it
    has documents (download links). Its title is the item's first line as printed; the
    recommendation text below it is left to the agenda itself."""
    root = pg_parse(page)
    items, heading, seen = [], None, set()
    for n in root.iter():
        cl = n.classes()
        if "section-row" in cl:
            heading = pg_heading(n)
        elif "meeting-item" in cl and n.attrs.get("data-itemid"):
            iid = n.attrs["data-itemid"]
            if iid in seen:
                continue
            seen.add(iid)
            atts, urls = [], set()
            for a in n.iter():
                href = a.attrs.get("href") or "" if a.tag == "a" else ""
                if "historyattachment" not in href:
                    continue
                name = re.sub(r"^Download\s+", "", (a.attrs.get("title") or "").strip()) or a.text(blocks=False).strip()
                if "${" in name or href in urls:   # an unfilled template placeholder, or a repeat
                    continue
                urls.add(href)
                atts.append({"name": name or None, "url": urllib.parse.urljoin(f"https://{tenant}.primegov.com/", href)})
            if not atts:
                continue
            title = first_line(n.find(lambda x: "agenda-item" in x.classes()))
            if not title:
                continue
            num = n.find(lambda x: "number-cell" in x.classes())
            items.append({
                "number": re.sub(r"\s+", " ", num.text(blocks=False)).strip() or None if num else None,
                "heading": heading,
                "title": title,
                "file": None,
                "type": None,
                "attachments": atts[:6],
            })
    return items


def pg_docs(m):
    """The agenda PDF and the HTML agenda to read items from, among a PrimeGov meeting's documents.
    Agendas first, then packets; cancellation notices are neither."""
    docs = [d for d in m.get("documentList") or [] if not re.search(r"cancel", d.get("templateName") or "", re.I)]
    rank = lambda d: (0 if re.search(r"agenda", d.get("templateName") or "", re.I) and not re.search(r"packet", d.get("templateName") or "", re.I) else 1 if re.search(r"agenda|packet", d.get("templateName") or "", re.I) else 9)
    pdf = sorted([d for d in docs if d.get("compileOutputType") == 1 and rank(d) < 9], key=rank)
    htm = sorted([d for d in docs if d.get("compileOutputType") == 3 and rank(d) < 9], key=rank)
    return (pdf[0] if pdf else None), (htm[0] if htm else None)


def pg_is_council(m):
    t = m.get("title") or ""
    # Santa Ana also posts each agenda again as "... Versión en Español"; records stay in English.
    return bool(re.search(r"council", t, re.I)) and not re.search(r"versi[oó]n en espa", t, re.I)


def primegov_meeting(m, tenant, page=None):
    base = f"https://{tenant}.primegov.com"
    pdf, htm = pg_docs(m)
    return {
        "body": m.get("title"),
        "date": (m.get("dateTime") or "")[:10],
        "time": cc_time(m.get("dateTime")),
        "location": (m.get("location") or "").strip() or None,
        "agenda_url": f"{base}/Public/CompiledDocument?meetingTemplateId={pdf['templateId']}&compileOutputType=1" if pdf else None,
        "meeting_url": f"{base}/Portal/Meeting?meetingTemplateId={htm['templateId']}" if htm else f"{base}/public/portal",
        "agenda_status": "Published" if pdf else None,
        "items": primegov_items(page, tenant) if (page and htm) else [],
    }


def primegov_city(tenant, today):
    base = f"https://{tenant}.primegov.com"
    end = (today + timedelta(days=DAYS)).isoformat()
    ups = fetch_json(f"{base}/api/v2/PublicPortal/ListUpcomingMeetings")
    ups = sorted([m for m in ups if pg_is_council(m) and today.isoformat() <= (m.get("dateTime") or "")[:10] <= end],
                 key=lambda m: m.get("dateTime") or "")
    meetings = []
    for m in ups[:PER_CITY]:
        _, htm = pg_docs(m)
        page = None
        if htm:
            page, final = fetch_text(f"{base}/Portal/Meeting?meetingTemplateId={htm['templateId']}")
            if "PublishedDocumentError" in final:
                page = None
        meetings.append(primegov_meeting(m, tenant, page))
    return {"source": f"{base}/public/portal", "meetings": meetings}


# ---------------------------------------------------------------- main

def main():
    today = date.today()
    out, problems = {}, []
    readers = [(c, legistar_city, a) for c, a in CITIES.items()] + [(c, civicclerk_city, t) for c, t in CIVICCLERK.items()] \
        + [(c, primegov_city, t) for c, t in PRIMEGOV.items()]
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
        "source": "Each city's agenda system: Legistar (webapi.legistar.com), CivicClerk (api.civicclerk.com) or PrimeGov (primegov.com)",
        "cities": out,
    }, open(OUT, "w"), indent=1, ensure_ascii=False)
    print(f"wrote {OUT}: {len(out)} cities")


if __name__ == "__main__":
    main()
