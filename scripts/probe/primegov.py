"""PrimeGov: for each city, upcoming and recent council meetings with their documents, and which
public portal routes serve an agenda as HTML or PDF (status, type, size). Prints only."""
import json, re, time, urllib.request, urllib.error
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
def get(url, n=20_000_000):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return r.status, r.headers.get("Content-Type"), r.geturl(), r.read(n)
def js(url): return json.loads(get(url)[3])
for t in ["lagunabeachcity", "lakeforest", "santa-ana", "sealbeach"]:
    B = f"https://{t}.primegov.com"
    print("=====", t)
    try:
        up = js(B + "/api/v2/PublicPortal/ListUpcomingMeetings")
        for m in up[:8]: print("UP", m["id"], m.get("title"), m.get("dateTime"), m.get("committeeId"), m.get("location"), [(d["templateId"], d["templateName"], d["compileOutputType"]) for d in m.get("documentList", [])])
        time.sleep(0.5)
        ar = js(B + "/api/v2/PublicPortal/ListArchivedMeetings?year=2026")
        print("ARCHIVED", len(ar), "KEYS", sorted(ar[0].keys()) if ar else None)
        council = [m for m in ar if re.search(r"council", m.get("title") or "", re.I) and m.get("documentList")]
        council.sort(key=lambda m: m.get("dateTime") or "", reverse=True)
        for m in council[:3]: print("PAST", m["id"], m.get("title"), m.get("dateTime"), m.get("committeeId"), [(d["templateId"], d["templateName"], d["compileOutputType"]) for d in m.get("documentList", [])])
        if council:
            m = council[0]
            for d in m["documentList"][:6]:
                for u in [f"{B}/Portal/Meeting?meetingTemplateId={d['templateId']}",
                          f"{B}/Public/CompiledDocument?meetingTemplateId={d['templateId']}&compileOutputType={d['compileOutputType']}",
                          f"{B}/Public/CompiledDocument/{d['id']}"]:
                    try:
                        st, ct, f, b = get(u)
                        title = re.search(rb"<title>(.*?)</title>", b, re.S)
                        print("  URL", st, ct, len(b), u, "->", f if f != u else "", title.group(1)[:80] if title else b[:40])
                    except urllib.error.HTTPError as e: print("  URL HTTP", e.code, u)
                    except Exception as e: print("  URL ERR", e, u)
                    time.sleep(0.4)
    except Exception as e: print("ERR", t, e)
