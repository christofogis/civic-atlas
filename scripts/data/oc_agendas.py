"""Orange County Board of Supervisors agendas: upcoming meetings item by item, in the county's own
wording, plus links to recent minutes. Source: the Clerk of the Board's agenda system
(ocagendaext.oc.gov), which board.oc.gov/meetings-agendas loads its tables from.

    python3 scripts/data/oc_agendas.py      # writes public/data/local/ca-orange-agendas.json

Each item keeps its number, the agenda section and heading it's under, the department, the
description exactly as printed, the districts it names, any status the Clerk added ("CONTINUED TO
...", "DELETED", "REVISED TITLE TO READ:"), and the link to its files. Nothing is summarized.
"""
import json, re, subprocess, sys, tempfile, urllib.request
from datetime import date, datetime

UPCOMING = "https://ocagendaext.oc.gov/bosmeetingc"
PREVIOUS = "https://ocagendaext.oc.gov/bosmeetingd"
UA = {"User-Agent": "civic-atlas data build (github.com/christofogis/civic-atlas)"}
OUT = "public/data/local/ca-orange-agendas.json"


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        return r.read()


def rows(html):
    """Table rows from the agenda system's HTML tables, as {data-label: (text, first href)}."""
    out = []
    for tr in re.findall(r"<tr>(.*?)</tr>", html, re.S):
        cells = {}
        for label, body in re.findall(r'<td[^>]*data-label="([^"]+)"[^>]*>(.*?)</td>', tr, re.S):
            href = re.search(r'href="([^"]+)"', body)
            cells[label] = (re.sub(r"<[^>]+>|\s+", " ", body).strip(), href.group(1) if href else None)
        if cells:
            out.append(cells)
    return out


def when(text):
    m = re.search(r"(\d{2})/(\d{2})/(\d{4}),\s*(\d{1,2}):(\d{2})\s*([AP])M", text)
    if not m:
        return None, None
    mo, d, y, h, mi, ap = m.groups()
    hh = int(h) % 12 + (12 if ap == "P" else 0)
    return f"{y}-{mo}-{d}", f"{hh:02d}:{mi}"


HEADER = re.compile(r"AGENDA - BOARD OF SUPERVISORS' MEETING.*PAGE \d+|Document Last Updated:.*")
ITEM = re.compile(r"^\s{0,12}((?:S?CS-?\d+[A-Z]?)|(?:S?\d+[A-Z]?))\.\s+(.*)$")
SECTION = re.compile(r"^\s*(CONSENT CALENDAR|DISCUSSION ITEMS|PUBLIC HEARINGS|CLOSED SESSION|PRESENTATIONS)\b")
STOP = re.compile(r"^\s*(PUBLIC COMMENTS|BOARD COMMENTS|ADJOURNED|END OF CONSENT CALENDAR)\b")
STATUS = re.compile(r"^(CONTINUED TO \d{1,2}/\d{1,2}/\d{2,4}(?:,? \d{1,2}:\d{2} [AP]\.M\.)?|DELETED|REVISED TITLE TO READ:|REVISED RECOMMENDED ACTIONS? TO READ:|REVISED RECOMMENDED ACTIONS?)\s*")


def parse_agenda(pdf_bytes):
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf_bytes)
    txt = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True, check=True).stdout
    # Each item's "(Click for Files)" link, matched by position: the item whose number is the last
    # one above the link on the page (or on an earlier page, for an item that runs over).
    files = {}
    try:
        import fitz
        last = None
        for pg in fitz.open(f.name):
            starts = sorted((w[1], w[4][:-1]) for w in pg.get_text("words")
                            if w[0] < 130 and re.fullmatch(r"(?:S?CS-?\d+[A-Z]?|S?\d+[A-Z]?)\.", w[4]))
            for l in sorted(pg.get_links(), key=lambda l: l["from"].y0):
                if "meetingitemfiles" not in (l.get("uri") or ""):
                    continue
                above = [n for y, n in starts if y <= l["from"].y1 + 1]
                num = above[-1] if above else last
                if num and num not in files:
                    files[num] = l["uri"]
            if starts:
                last = starts[-1][1]
    except Exception as e:
        print("file links not read:", e)
    if "--debug" in sys.argv:
        i = txt.find("PUBLIC HEARINGS")
        print("TAIL", txt[i:i + 9000])
    updated = re.search(r"Document Last Updated: (\d{2})/(\d{2})/(\d{4})", txt)
    lines = [l for l in txt.splitlines() if not HEADER.search(l)]
    start = next((i for i, l in enumerate(lines) if SECTION.match(l)), len(lines))
    items, section, group, cur = [], None, None, None

    def close():
        nonlocal cur
        if cur:
            items.append(cur)
            cur = None

    for line in lines[start:]:
        s = line.strip()
        if not s:
            if cur and cur["_text"]:
                close()
            continue
        if SECTION.match(line):
            close(); section = SECTION.match(line).group(1).title(); group = None; continue
        if STOP.match(line):
            close(); section = None if not line.strip().startswith("END OF CONSENT") else section; continue
        m = ITEM.match(line)
        if m and section:
            close()
            cur = {"number": m.group(1), "section": section, "group": group, "_text": [m.group(2).strip()]}
            continue
        if cur is not None:
            cur["_text"].append(s)
        elif section and s.isupper() and len(s) < 60 and not s.startswith("("):
            group = s.title()
    close()

    out = []
    for it in items:
        text = re.sub(r"\s+", " ", " ".join(it.pop("_text"))).strip()
        status = None
        sm = STATUS.match(text)
        if sm:
            status, text = sm.group(1).strip().rstrip(":"), text[sm.end():].strip()
        has_files = "(Click for Files)" in text or "(Click for\nFiles)" in text
        text = text.replace("(Click for Files)", "").strip()
        dm = re.search(r" - (All Districts|Districts? [\d ,and]+?)(?= \(|$)", text)
        districts = None
        if dm:
            districts = "all" if dm.group(1) == "All Districts" else [int(x) for x in re.findall(r"\d", dm.group(1))]
        dept = text.split(" - ", 1)[0] if " - " in text else None
        out.append({**it, "status": status, "department": dept, "text": text, "districts": districts, "_files": has_files})
    with_files = [x for x in out if x["_files"]]
    for x in out:
        if x.pop("_files") and x["number"] in files:
            x["files_url"] = files[x["number"]]
    upd = f"{updated.group(3)}-{updated.group(1)}-{updated.group(2)}" if updated else None
    return out, upd, len(with_files), sum(1 for x in out if x.get("files_url"))


meetings = []
for r in rows(get(UPCOMING).decode("utf-8", "replace")):
    d, t = when(r.get("Meeting Date/Time", ("", None))[0])
    agenda = r.get("Agenda", ("", None))[1]
    m = {
        "title": r.get("Meeting Title", ("", None))[0],
        "date": d, "time": t,
        "location": r.get("Meeting Location", ("", None))[0],
        "agenda_url": agenda,
        "modifications_url": r.get("Agenda Modifications", ("", None))[1],
        "register_url": r.get("Register to Speak", ("", None))[1],
        "video_url": r.get("Watch Live", ("", None))[1],
        "items": [],
    }
    if agenda:
        items, upd, nf, nl = parse_agenda(get(agenda))
        m["items"], m["agenda_updated"] = items, upd
        print(f"{d} {m['title']}: {len(items)} items; file links found for {nl} of {nf} items that have files")
        if len(items) < 3:
            sys.exit(f"{d}: only {len(items)} items parsed; the agenda layout may have changed")
    meetings.append(m)

previous = []
for r in rows(get(PREVIOUS).decode("utf-8", "replace"))[:6]:
    d, t = when(r.get("Meeting Date/Time", ("", None))[0])
    previous.append({"title": r.get("Meeting Title", ("", None))[0], "date": d, "time": t,
                     "minutes_url": r.get("Accessible Minutes with Hyperlinks to Documents", ("", None))[1],
                     "video_url": r.get("Board Meeting Video", ("", None))[1]})

json.dump({
    "built_at": date.today().isoformat(),
    "source": "Orange County Clerk of the Board, Board of Supervisors meeting agendas",
    "source_url": "https://board.oc.gov/meetings-agendas",
    "meetings": meetings,
    "previous": previous,
}, open(OUT, "w"), indent=1, ensure_ascii=False)
print(f"wrote {OUT}: {len(meetings)} upcoming, {len(previous)} previous")
