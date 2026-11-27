"""Audit, fifth pass. Prints only: candidates and counts in the Registrar's results for the Los Alamitos
council and Board of Supervisors contests (Nov 2026), and the June 2026 primary if its page is found."""
import re, urllib.request, html
UA = {"User-Agent": "Mozilla/5.0 (civic-atlas audit probe; github.com/christofogis/civic-atlas)"}
def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r: return r.status, r.read().decode("utf-8", "replace")
    except Exception as e: return None, f"ERR {e}"
def text(h): return re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", re.sub(r"(?is)<(script|style).*?</\1>", " ", h))))
for n in (24, 23, 22):
    u = f"https://www.livevoterturnout.com/ENR/orangecaenr/{n}/en/Index_{n}.html"
    st, h = get(u)
    if st is None:
        st, h = get(f"https://www.livevoterturnout.com/ENR/orangecaenr/{n}/en/phkv4sV_Index_{n}.html")
    t = text(h)
    print(f"\n===== ENR {n}: {st}", t[:200])
    for m in re.finditer(r"Contest: (CITY OF LOS ALAMITOS[^,]*|County Supervisor[^,]*|Assessor|Auditor-Controller|Clerk-Recorder|District Attorney[^,]*|Sheriff[^,]*|Treasurer-Tax Collector|County Superintendent[^,]*), VOTE FOR \d+ .*?(?=Contest: )", t):
        seg = m.group(0)
        seg = re.sub(r"Vote-by-Mail Ballots Vote Center Ballots Total --> Candidate Name Total Votes Percentage", "|", seg)
        print("  CONTEST", seg[:700])
    for m in list(re.finditer(r"(Last Updated|Updated|Semi-Official|Official|Final)[^.]{0,120}", t))[:3]: print("  STATUS", m.group(0))
