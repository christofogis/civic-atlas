"""CivicClerk: confirm GetAttachmentFile serves the recorded attachment, and list the API routes the
portal script calls (to find the staff-report link). Prints only."""
import re, time, urllib.request, urllib.error
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
BASE = "https://lagunahillsca.portal.civicclerk.com"
API = "https://lagunahillsca.api.civicclerk.com/v1/"
def raw(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r:
        return r.status, r.headers.get("Content-Type"), r.read()
for u in [API + "Meetings/GetAttachmentFile(fileId=2305)", API + "Meetings/GetAttachmentFile(fileId=1796)"]:
    try:
        st, ct, b = raw(u); print("URL", st, ct, len(b), u, "(attachment 2305 is recorded as 313556 bytes)")
    except urllib.error.HTTPError as e: print("URL HTTP", e.code, u)
    time.sleep(0.5)
h = raw(BASE + "/")[2].decode()
js = raw(BASE + re.search(r'src="(/assets/index-[^"]+\.js)"', h).group(1))[2].decode("utf-8", "replace")
names = sorted(set(re.findall(r'(assets/utils-[\w-]+\.js|assets/[\w-]*[Ee]vent[\w-]*\.js|assets/[\w-]*[Ff]ile[\w-]*\.js|assets/[\w-]*[Mm]eeting[\w-]*\.js)', js)))
print("CHUNKS", names)
for n in names[:12]:
    t = raw(BASE + "/" + n)[2].decode("utf-8", "replace")
    for r in sorted(set(re.findall(r'`((?:Meetings|Events|MeetingItems|Items|Reports|Files)/[^`]{0,120})`', t))): print("ROUTE", n, r)
    for m in list(re.finditer(r"reportsList|agendaObjItemReport|fileType", t))[:6]:
        print("CTX", n, t[max(0, m.start() - 200): m.end() + 200].replace("\n", " "))
    time.sleep(0.3)
