"""Audit, third pass. Prints only: county officer pages, the Registrar's 2026 election pages, and
links the first-time voter and measures pages use."""
import re, urllib.request, html
UA = {"User-Agent": "Mozilla/5.0 (civic-atlas audit probe; github.com/christofogis/civic-atlas)"}
def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r: return r.status, r.geturl(), r.read().decode("utf-8", "replace")
    except Exception as e: return None, u, f"ERR {e}"
def text(h): return re.sub(r"\s+", " ", html.unescape(re.sub(r"(?s)<[^>]+>", " ", re.sub(r"(?is)<(script|style).*?</\1>", " ", h))))
def show(u, pats, links=None):
    st, final, h = get(u); t = text(h)
    print(f"\n===== {u} -> {st} {final if final != u else ''} {h[:100] if st is None else ''}")
    for p in pats:
        for m in list(re.finditer(p, t, re.I))[:4]: print("  ...", t[max(0, m.start()-150): m.end()+250])
    if links:
        for href, label in re.findall(r'href="([^"]+)"[^>]*>(.*?)</a>', h, re.S):
            l = text(label).strip()
            if re.search(links, href + " " + l, re.I): print("  LINK", href, "|", l[:90])
show("https://ocauditor.com/", [r"Auditor-Controller\s+\w+ \w+", r"Hamilton"])
show("https://ocsheriff.gov/", [r"Sheriff\s+Don Barnes", r"Barnes"])
show("https://ocvote.gov/elections/2026-general-election", [r"Los Alamitos", r"Supervisor", r"certif"], r"result|candidate|contest|measure|sov|statement")
show("https://ocvote.gov/elections/2026-statewide-direct-primary-election", [r"Supervisor", r"Assessor", r"Sheriff"], r"result|candidate|sov|statement")
show("https://ocvote.gov/results/current-election-results", [r"Los Alamitos", r"Supervisor"], r"result|clarity|enr|xml|json|csv")
show("https://ocvote.gov/data/election-results-archives", [], r"2026|2024")
for u in ["https://registertovote.ca.gov/", "https://registertovote.ca.gov/es", "https://voterstatus.sos.ca.gov/",
          "https://www.sos.ca.gov/elections/pre-register-16-vote-18", "https://www.archives.gov/founding-docs/amendments-11-27",
          "https://elections.cdn.sos.ca.gov/ballot-measures/pdf/aca-7.pdf", "https://elections.cdn.sos.ca.gov/ballot-measures/top-funders/1995-top-funders-11-13-25.pdf",
          "https://oag.ca.gov/system/files/initiatives/pdfs/25-0018A1%20%28UC%20Down%20Payment%20Loans%29.pdf", "https://lao.ca.gov/ballot/2025/250426.pdf",
          "https://www.sos.ca.gov/elections/ballot-measures/initiative-and-referendum-status/official-top-funders"]:
    st, final, h = get(u); print("LINK-STATUS", st, u, "->", final if final != u else "", h[:80] if st is None else "")
show("https://www.sos.ca.gov/elections/pre-register-16-vote-18", [r"16", r"pre-regist"])
show("https://www.sos.ca.gov/elections/ballot-measures/initiative-and-referendum-status/official-top-funders", [r"1995", r"25-0018"], r"1995|25-0018")
show("https://www.sos.ca.gov/elections/ballot-measures/qualified-ballot-measures", [r"SB 895", r"March 7, 2028"], r"sb-895|aca-7")
show("https://www.sos.ca.gov/elections/upcoming-elections", [r"2028", r"March 7", r"Presidential Primary"])
