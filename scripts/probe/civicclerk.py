"""CivicClerk fields for the agenda reader: one published Laguna Hills council agenda in full (raw
JSON), upcoming council events for the three cities, and which public file links answer. Prints only."""
import json, re, time, urllib.request, urllib.error, urllib.parse
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
def get(url, n=10_000_000):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.status, r.headers.get("Content-Type"), r.read(n)
def js(url): return json.loads(get(url)[2])
for t in ["fountainvalleyca", "lapalmaca", "lagunahillsca"]:
    q = urllib.parse.quote("startDateTime ge 2026-11-26T00:00:00Z", safe="")
    for e in js(f"https://{t}.api.civicclerk.com/v1/Events?$filter={q}&$orderby=startDateTime&$top=10")["value"]:
        print("EV", t, e["id"], e.get("eventName"), "|", e.get("categoryName"), e.get("startDateTime"), "agendaId", e.get("agendaId"), "files", len(e.get("publishedFiles") or []))
    time.sleep(0.5)
ev = js("https://lagunahillsca.api.civicclerk.com/v1/Events?$filter=id+eq+843")["value"][0]
print("EVENTRAW", json.dumps(ev)[:4000])
m = js("https://lagunahillsca.api.civicclerk.com/v1/Meetings/835")
print("MEETINGRAW", json.dumps(m))
# Which public links answer for a file and an attachment
pf = (ev.get("publishedFiles") or [{}])[0]
att = None
def find(xs):
    for x in xs:
        if x.get("attachmentsList"): return x["attachmentsList"][0]
        r = find(x.get("childItems") or [])
        if r: return r
att = find(m.get("items") or [])
print("PF", json.dumps(pf)); print("ATT", json.dumps(att))
cands = []
if pf.get("fileId"):
    cands += [f"https://lagunahillsca.api.civicclerk.com/v1/Meetings/GetMeetingFileStream(fileId={pf['fileId']},plainText=false)",
              f"https://lagunahillsca.portal.civicclerk.com/event/843/files/agenda/{pf['fileId']}"]
if att:
    for k in ("fileId", "id", "attachmentId"):
        if att.get(k):
            cands += [f"https://lagunahillsca.api.civicclerk.com/v1/Meetings/GetMeetingFileStream(fileId={att[k]},plainText=false)",
                      f"https://lagunahillsca.portal.civicclerk.com/event/843/files/attachment/{att[k]}"]
    if att.get("pdfVersionFullPath") or att.get("mediaFullPath"): cands.append(att.get("pdfVersionFullPath") or att.get("mediaFullPath"))
cands.append("https://lagunahillsca.portal.civicclerk.com/event/843/files")
for u in cands:
    try:
        st, ct, b = get(u, 2000); print("LINK", st, ct, len(b), u, b[:60])
    except urllib.error.HTTPError as e: print("LINK HTTP", e.code, u)
    except Exception as e: print("LINK ERR", u, e)
    time.sleep(0.5)
