"""CivicClerk portal script: the code around its file links (attachments, reports, agenda files),
to find the public route for one item attachment. Prints only."""
import re, urllib.request
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r: return r.read().decode("utf-8", "replace")
h = get("https://lagunahillsca.portal.civicclerk.com/")
js = get("https://lagunahillsca.portal.civicclerk.com" + re.search(r'src="(/assets/index-[^"]+\.js)"', h).group(1))
print("LEN", len(js))
seen = 0
for pat in [r"GetMeetingFileStream", r"files/", r"FileStream\.ashx", r"attachmentsList", r"reportsList", r"mediaFullPath", r"pdfVersionFullPath", r"agendaObjItemReport", r"/attachment", r"/report"]:
    for m in list(re.finditer(pat, js))[:4]:
        print("CTX", pat, "|", js[max(0, m.start() - 250): m.end() + 250].replace("\n", " "))
