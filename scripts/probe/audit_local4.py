"""Audit, fourth pass. Prints only: the Registrar's current results (Los Alamitos council, supervisors),
the newest top-funders PDF for initiative 1995, the Sheriff, and SB 895 on the SOS list."""
import re, urllib.request, html, urllib.parse
UA = {"User-Agent": "Mozilla/5.0 (civic-atlas audit probe; github.com/christofogis/civic-atlas)"}
def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r: return r.status, r.read().decode("utf-8", "replace")
    except Exception as e: return None, f"ERR {e}"
def text(h): return re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", re.sub(r"(?is)<(script|style).*?</\1>", " ", h))))
base = "https://www.livevoterturnout.com/ENR/orangecaenr/24/en/"
st, h = get(base + "phkv4sV_Index_24.html"); t = text(h)
print("ENR index", st, t[:600])
links = re.findall(r'href="([^"]+)"[^>]*>(.*?)</a>', h, re.S)
for href, l in links:
    l = text(l).strip()
    if re.search(r"Alamitos|Supervisor|Council|Summary|Contest|Assessor|Sheriff", href + l, re.I): print("  LINK", href, "|", l[:90])
for m in list(re.finditer(r"Los Alamitos", t))[:8]: print("  ...", t[max(0, m.start()-200): m.end()+400])
for u in [l for l, _ in links if re.search(r"summary|contest", l, re.I)][:3]:
    st, hh = get(urllib.parse.urljoin(base, u)); tt = text(hh)
    print("\nPAGE", u, st, len(tt))
    for m in list(re.finditer(r"Los Alamitos|SUPERVISOR", tt, re.I))[:12]: print("  ...", tt[max(0, m.start()-100): m.end()+500])
for d in ["05-01-26", "06-01-26", "07-01-26", "08-03-26", "09-01-26", "10-01-26", "11-02-26"]:
    u = f"https://elections.cdn.sos.ca.gov/ballot-measures/top-funders/1995-top-funders-{d}.pdf"
    st, _ = get(u); print("FUNDERS", d, st)
st, h = get("https://www.sos.ca.gov/elections/ballot-measures/initiative-and-referendum-status/official-top-funders")
for href, l in re.findall(r'href="([^"]+)"[^>]*>(.*?)</a>', h, re.S):
    if "1995" in href: print("  FLINK", href, text(l))
st, h = get("https://www.sos.ca.gov/elections/ballot-measures/qualified-ballot-measures")
for href, l in re.findall(r'href="([^"]+)"[^>]*>(.*?)</a>', h, re.S):
    if re.search(r"895|aca-7|2028", href + l, re.I): print("  QLINK", href, text(l))
st, h = get("https://ocsheriff.gov/about-ocsd/sheriff-don-barnes"); print("SHERIFF page", st, text(h)[:300] if st else h[:100])
