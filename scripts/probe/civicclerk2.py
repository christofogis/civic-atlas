"""CivicClerk: which stable public URL serves one item attachment and one staff report. Compares
file sizes with the API's own record, and lists the file-stream routes the public portal's script
uses. Prints only."""
import re, time, urllib.request, urllib.error
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
def get(url, n=40_000_000):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        b = r.read(n); return r.status, r.headers.get("Content-Type"), r.headers.get("Content-Disposition"), b
B = "https://lagunahillsca.api.civicclerk.com/v1/"
# attachment 2305 is 313556 bytes "Excursion to Sony Pictures_Flyer_.pdf"; report 1796 is the "November 10, 2026 Schedule of Events Report"
for u in [B + "Meetings/GetMeetingFileStream(fileId=2305,plainText=false)",
          B + "Meetings/GetAttachmentFileStream(attachmentId=2305)",
          B + "Meetings/GetItemAttachmentFileStream(fileId=2305,plainText=false)",
          B + "Meetings/GetReportFileStream(reportId=1796)",
          B + "Meetings/GetMeetingFileStream(fileId=1796,plainText=false)"]:
    try:
        st, ct, cd, b = get(u); print("URL", st, ct, cd, len(b), u)
    except urllib.error.HTTPError as e: print("URL HTTP", e.code, u)
    except Exception as e: print("URL ERR", e, u)
    time.sleep(0.5)
try:
    _, _, _, h = get("https://lagunahillsca.portal.civicclerk.com/")
    srcs = re.findall(r'src="([^"]+\.js)"', h.decode("utf-8", "replace"))
    print("JS", srcs)
    for s in srcs[:6]:
        u = s if s.startswith("http") else "https://lagunahillsca.portal.civicclerk.com" + ("" if s.startswith("/") else "/") + s
        _, _, _, js = get(u); t = js.decode("utf-8", "replace")
        for m in sorted(set(re.findall(r'[A-Za-z/]*(?:Stream|files/)[A-Za-z/(]*[^"`\']{0,80}', t)))[:60]: print("  ROUTE", m[:160])
        time.sleep(0.5)
except Exception as e: print("JS ERR", e)
