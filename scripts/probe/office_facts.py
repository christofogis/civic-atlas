"""Check the facts in src/lib/offices.js against their primary sources: print the passage around
each fact's key words from each source page. Prints only; writes nothing."""
import html
import re
import urllib.request

CONS = "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CONS&sectionNum=SEC.%20{s}.&article={a}"
CODE = "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode={c}&sectionNum={s}"
USC = "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title{t}-section{s}&num=0&edition=prelim"

CHECKS = [
    ("https://constitution.congress.gov/constitution/article-1/", [r"second Year", r"Power of Impeachment", r"two Senators", r"President of the Senate", r"try all Impeachments", r"Bills for raising Revenue", r"before it become a Law"]),
    ("https://constitution.congress.gov/constitution/article-2/", [r"executive Power shall be vested", r"Term of four Years", r"appoint, in such Manner", r"Commander in Chief", r"Treaties", r"faithfully executed"]),
    ("https://constitution.congress.gov/constitution/amendment-17/", [r"two Senators from each State"]),
    ("https://constitution.congress.gov/constitution/amendment-22/", [r"No person shall be elected"]),
    ("https://www.archives.gov/founding-docs/constitution-transcript", [r"second Year", r"two Senators", r"President of the Senate", r"Term of four Years", r"Commander in Chief", r"before it become a Law"]),
    ("https://www.archives.gov/founding-docs/amendments-11-27", [r"two Senators from each State", r"No person shall be elected to the office of the President"]),
    (USC.format(t="2", s="2a"), [r"apportion", r"then existing number"]),
    (USC.format(t="2", s="25a"), [r"Delegate", r"term"]),
    (USC.format(t="48", s="891"), [r"Resident Commissioner", r"four years"]),
    (USC.format(t="48", s="1711"), [r"Delegate", r"two-year|two years"]),
    (USC.format(t="48", s="1731"), [r"Delegate", r"two-year|two years"]),
    (USC.format(t="48", s="1751"), [r"Delegate", r"two-year|two years"]),
    ("https://www.govinfo.gov/content/pkg/HMAN-119/html/HMAN-119-pg404.htm", [r"Delegate", r"Resident Commissioner"]),
    (CONS.format(s="2", a="IV"), [r"40 members", r"80 members", r"four years", r"two years", r"12 years"]),
    (CONS.format(s="10", a="IV"), [r"Governor", r"reduce or eliminate", r"two-thirds"]),
    (CONS.format(s="1", a="V"), [r"supreme executive power"]),
    (CONS.format(s="2", a="V"), [r"four", r"two terms"]),
    (CONS.format(s="9", a="V"), [r"President of the Senate", r"casting vote"]),
    (CONS.format(s="10", a="V"), [r"Lieutenant Governor shall become Governor", r"vacancy"]),
    (CONS.format(s="11", a="V"), [r"Attorney General", r"two terms"]),
    (CONS.format(s="13", a="V"), [r"chief law officer"]),
    (CONS.format(s="2", a="IX"), [r"Superintendent of Public Instruction"]),
    (CONS.format(s="6", a="II"), [r"nonpartisan"]),
    (CONS.format(s="17", a="XIII"), [r"Board of Equalization", r"four", r"Controller"]),
    (CONS.format(s="19", a="XIII"), [r"Board shall annually assess", r"pipelines|railroad"]),
    (CONS.format(s="1", a="XI"), [r"governing body", r"sheriff", r"assessor"]),
    (CODE.format(c="GOV", s="12172.5"), [r"chief elections officer"]),
    (CODE.format(c="GOV", s="12410"), [r"superintend the fiscal concerns", r"audit"]),
    (CODE.format(c="GOV", s="12320"), [r"Treasurer"]),
    (CODE.format(c="GOV", s="12325"), [r"Treasurer"]),
    (CODE.format(c="INS", s="12900"), [r"commissioner", r"four"]),
    (CODE.format(c="INS", s="12921"), [r"enforce"]),
    (CODE.format(c="GOV", s="25000"), [r"five members", r"supervisor"]),
    (CODE.format(c="GOV", s="24009"), [r"elected"]),
    (CODE.format(c="GOV", s="24200"), [r"four years|elected"]),
    (CODE.format(c="GOV", s="26600"), [r"preserve peace"]),
    (CODE.format(c="GOV", s="26500"), [r"public prosecutor"]),
    (CODE.format(c="GOV", s="27491"), [r"coroner"]),
    (CODE.format(c="GOV", s="26900"), [r"auditor|chief accounting"]),
    (CODE.format(c="GOV", s="27201"), [r"record"]),
    (CODE.format(c="GOV", s="26801"), [r"county clerk"]),
    (CODE.format(c="GOV", s="27000"), [r"treasurer"]),
    (CODE.format(c="RTC", s="405"), [r"assessor"]),
    (CODE.format(c="RTC", s="2602"), [r"tax collector"]),
    (CODE.format(c="GOV", s="34000"), [r"general law city|charter"]),
    (CODE.format(c="GOV", s="36501"), [r"city council"]),
    ("https://www.ocgov.com/residents/gov/elected", [r"Sheriff", r"Assessor", r"Auditor", r"Clerk", r"Treasurer", r"District Attorney", r"four"]),
    ("https://board.oc.gov/about-board", [r"five", r"four-year", r"two four-year", r"chair"]),
    ("https://cityoflosalamitos.org/165/City-Council", [r"five members", r"District", r"four years", r"Mayor", r"legislative body", r"Charter"]),
    ("https://cityoflosalamitos.org/27/Government", [r"charter|Charter", r"general law"]),
]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (fact check)"})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read(3000000).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}: {e}", ""


def text(body):
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", body, flags=re.S | re.I)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", body)))


for url, pats in CHECKS:
    status, body = get(url)
    t = text(body)
    print(f"\n=== {status} {url} ({len(t)} chars)")
    for p in pats:
        hits = [m.start() for m in re.finditer(p, t, re.I)][:2]
        if not hits:
            print(f"  [{p}] NOT FOUND")
        for h in hits:
            print(f"  [{p}] ...{t[max(0, h - 250):h + 450]}...")
