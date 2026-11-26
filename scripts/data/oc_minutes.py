"""Orange County Board of Supervisors: what the Board did at recent meetings, item by item, from
the Clerk of the Board's summary action minutes. For each item: its number and description as
printed, then each motion as printed ("ON THE MOTION OF ..., APPROVED ITEM AS RECOMMENDED") with
the vote lines exactly as recorded (Ayes, Noes, Abstained, Absent). Nothing is inferred: a
supervisor's vote is shown only where the minutes name them.

    python3 scripts/data/oc_minutes.py      # writes public/data/local/ca-orange-minutes.json
"""
import json, re, subprocess, sys, tempfile, urllib.request
from datetime import date

AGENDAS = "public/data/local/ca-orange-agendas.json"
OUT = "public/data/local/ca-orange-minutes.json"
UA = {"User-Agent": "civic-atlas data build (github.com/christofogis/civic-atlas)"}
KEEP = 8  # most recent meetings with minutes

HEADER = re.compile(r"MINUTES - BOARD OF SUPERVISORS' MEETING.*PAGE \d+|Document Last Updated:.*|^\s*SUMMARY ACTION MINUTES\s*$")
SECTION = re.compile(r"^\s*(CONSENT CALENDAR|DISCUSSION ITEMS|PUBLIC HEARINGS|CLOSED SESSION)\b")
STOP = re.compile(r"^\s*(PUBLIC COMMENTS|BOARD COMMENTS|ADJOURNED)\b")
ITEM = re.compile(r"^\s{0,12}((?:S?CS-?\d+[A-Z]?)|(?:S?\d+[A-Z]?))\.\s+(.*)$")
MOTION = re.compile(r"^\s*(ON THE MOTION OF|BOARD ORDER|BOARD APPROVED|DELETED|NO ACTION|RECEIVED AND FILED|BOARD (?:DIRECTED|RECEIVED))")
VOTE = re.compile(r"^\s*(Ayes|Noes|Abstained|Absent|Excused|Recused)\s*:\s*(.*)$")
EXTRA = re.compile(r"^\s*(Resolution No\(s\)\.|Ordinance No\(s\)\.|Minute Order)")


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
        return r.read()


def parse(pdf):
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(pdf)
    txt = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True, check=True).stdout
    lines = [l for l in txt.splitlines() if not HEADER.search(l)]
    items, section, cur, mode = [], None, None, None

    def close():
        nonlocal cur
        if cur:
            cur["text"] = re.sub(r"\s+", " ", " ".join(cur.pop("_t"))).replace("(Click to View Files)", "").strip()
            for a in cur["actions"]:
                a["motion"] = re.sub(r"\s+", " ", " ".join(a.pop("_m"))).strip()
            items.append(cur)
            cur = None

    for line in lines:
        s = line.strip()
        if SECTION.match(line):
            close(); section = SECTION.match(line).group(1).title(); continue
        if STOP.match(line):
            close(); section = None; continue
        if not section or re.match(r"^\s*END OF CONSENT CALENDAR", line):
            continue
        m = ITEM.match(line)
        if m:
            close()
            cur = {"number": m.group(1), "section": section, "_t": [m.group(2).strip()], "actions": []}
            mode = "text"
            continue
        if cur is None or not s:
            continue
        v = VOTE.match(line)
        if v and cur["actions"]:
            names = [n.strip() for n in re.split(r",| and ", v.group(2)) if n.strip()]
            cur["actions"][-1]["votes"][v.group(1)] = names
            mode = "votes"
            continue
        if MOTION.match(line):
            cur["actions"].append({"_m": [s], "votes": {}})
            mode = "motion"
            continue
        if EXTRA.match(line):
            if cur["actions"]:
                cur["actions"][-1].setdefault("notes", []).append(s)
            continue
        if mode == "text":
            cur["_t"].append(s)
        elif mode == "motion":
            cur["actions"][-1]["_m"].append(s)
        # lines after vote lines that aren't a new item, motion or note are page furniture
    close()
    return items


ag = json.load(open(AGENDAS))
try:
    old = {m["date"] + m.get("time", ""): m for m in json.load(open(OUT))["meetings"]}
except Exception:
    old = {}
meetings = []
for p in (ag.get("previous") or [])[:KEEP]:
    if not p.get("minutes_url"):
        continue
    key = p["date"] + (p.get("time") or "")
    try:
        items = parse(get(p["minutes_url"]))
    except Exception as e:
        print(f"{p['date']}: minutes not read ({e}); keeping earlier copy if any")
        if key in old:
            meetings.append(old[key])
        continue
    if len(items) < 2:
        print(f"{p['date']}: only {len(items)} items parsed; skipped")
        if key in old:
            meetings.append(old[key])
        continue
    voted = sum(1 for i in items for a in i["actions"] if a["votes"])
    print(f"{p['date']} {p['title']}: {len(items)} items, {voted} recorded votes")
    meetings.append({**p, "items": items})

if not meetings:
    sys.exit("no minutes read")
json.dump({
    "built_at": date.today().isoformat(),
    "source": "Orange County Clerk of the Board, summary action minutes",
    "source_url": "https://board.oc.gov/meetings-agendas",
    "meetings": meetings,
}, open(OUT, "w"), indent=1, ensure_ascii=False)
print(f"wrote {OUT}: {len(meetings)} meetings")
