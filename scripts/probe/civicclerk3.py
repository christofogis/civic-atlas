"""CivicClerk portal scripts: the code around its file links (attachments, reports, agenda files),
to find the public route for one item attachment. The main script loads others on demand; reads
those it names (at most 60). Prints only."""
import re, time, urllib.request
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
BASE = "https://lagunahillsca.portal.civicclerk.com"
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=40) as r: return r.read().decode("utf-8", "replace")
h = get(BASE + "/")
main = re.search(r'src="(/assets/index-[^"]+\.js)"', h).group(1)
todo, done = [main], set()
PATS = [r"GetMeetingFileStream", r"FileStream", r"attachmentsList", r"reportsList", r"pdfVersionFullPath", r"files/attachment", r"/attachment/", r"/report/", r"/files/"]
while todo and len(done) < 60:
    p = todo.pop(0)
    if p in done: continue
    done.add(p)
    try: js = get(BASE + p)
    except Exception as e: print("ERR", p, e); continue
    for c in re.findall(r'(?:"|/|\./)(assets/[\w.-]+\.js)', js):
        c = "/" + c
        if c not in done and c not in todo: todo.append(c)
    hits = 0
    for pat in PATS:
        for m in list(re.finditer(pat, js))[:3]:
            hits += 1; print("CTX", p, pat, "|", js[max(0, m.start() - 220): m.end() + 220].replace("\n", " "))
    time.sleep(0.3)
print("READ", len(done), "scripts; left", len(todo))
