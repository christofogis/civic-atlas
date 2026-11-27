"""Audit, sixth pass. Prints only: every member and district on the Assembly's and Senate's own rosters."""
import re, urllib.request, html
UA = {"User-Agent": "Mozilla/5.0 (civic-atlas audit probe; github.com/christofogis/civic-atlas)"}
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r: return r.read().decode("utf-8", "replace")
def text(h): return re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", re.sub(r"(?is)<(script|style).*?</\1>", " ", h))))
t = text(get("https://www.assembly.ca.gov/assemblymembers"))
for m in re.finditer(r"View Details ([^,]{2,40}), ([^,]{2,40}?) District: (\d+) (\w+)", " View Details " + t.split("View Details", 1)[1] if "View Details" in t else t):
    print("AD", int(m.group(3)), m.group(2), m.group(1), m.group(4))
t = text(get("https://www.senate.ca.gov/senators"))
for m in re.finditer(r"([A-Z][\w.'\- ]{2,50}?) \((D|R|V|I)\) District (\d+)", t):
    print("SD", int(m.group(3)), m.group(1).strip()[-40:], m.group(2))
