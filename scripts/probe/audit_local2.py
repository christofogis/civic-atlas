"""Audit, second pass. Prints only. (1) Re-reads the Board minutes with the fixed parser and prints
item counts and the rebuilt file. (2) Links on the Registrar's results pages, and county officer pages."""
import json, re, runpy, sys, urllib.request, html
sys.argv = ["oc_minutes.py"]
runpy.run_path("scripts/data/oc_minutes.py", run_name="__main__")
d = json.load(open("public/data/local/ca-orange-minutes.json"))
for m in d["meetings"]:
    print("MEET", m["date"], len(m["items"]), [(i["number"], len(i["actions"])) for i in m["items"] if len(i["actions"]) > 1 or i["number"].startswith("S")])
print("JSONSTART"); print(json.dumps(d, ensure_ascii=False)); print("JSONEND")

UA = {"User-Agent": "Mozilla/5.0 (civic-atlas audit probe; github.com/christofogis/civic-atlas)"}
def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r: return r.read().decode("utf-8", "replace")
    except Exception as e: return f"ERR {e}"
def text(h): return re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", re.sub(r"(?is)<(script|style).*?</\1>", " ", h))))
for u in ["https://ocvote.gov/results", "https://ocvote.gov/elections", "https://www.ocgov.com/residents/gov/elected"]:
    h = get(u); print("\n=====", u, h[:80] if h.startswith("ERR") else "")
    for href, label in re.findall(r'href="([^"]+)"[^>]*>(.*?)</a>', h, re.S):
        l = text(label).strip()
        if re.search(r"result|2026|general|assessor|sheriff|attorney|clerk|auditor|treasurer|superintendent|elected", href + l, re.I): print("  LINK", href, "|", l[:80])
    t = text(h)
    for p in [r"Assessor", r"Sheriff", r"District Attorney", r"Superintendent", r"Clerk-Recorder", r"Auditor", r"Treasurer"]:
        for mm in list(re.finditer(p, t))[:2]: print("  ...", t[max(0, mm.start()-120): mm.end()+160])
