"""Official 2028 election dates for "Your 2028 ballot": what the California Secretary of State and the
Orange County Registrar of Voters have published so far (election calendars, registration and
vote-by-mail rules, candidate filing periods). Prints page status, links that mention 2028, and the
text around date words. Writes nothing."""
import html
import re
import subprocess
import urllib.parse
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (civic-atlas date check)"}

PAGES = [
    "https://www.sos.ca.gov/elections/upcoming-elections",
    "https://www.sos.ca.gov/elections/key-dates",
    "https://www.sos.ca.gov/elections/voter-registration",
    "https://www.sos.ca.gov/elections/voter-registration/same-day-reg",
    "https://www.sos.ca.gov/elections/voter-registration/vote-mail",
    "https://www.sos.ca.gov/elections/pre-register-16-vote-18",
    "https://www.sos.ca.gov/elections/candidates",
    "https://www.sos.ca.gov/elections/candidates/running-office",
    "https://www.sos.ca.gov/elections/upcoming-elections/primary-election-march-7-2028",
    "https://www.sos.ca.gov/elections/upcoming-elections/presidential-primary-election-march-7-2028",
    "https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-7-2028",
    "https://registertovote.ca.gov/",
    "https://ocvote.gov/",
    "https://ocvote.gov/elections",
    "https://ocvote.gov/upcoming-elections",
    "https://ocvote.gov/candidates",
    "https://ocvote.gov/register",
    "https://ocvote.gov/vote-by-mail",
    "https://ocvote.gov/vote-center",
    "https://ocvote.gov/data/election-results-archives",
]
KEYS = re.compile(r"2028|15 days|fifteen|E-\d+|nomination period|filing period|declaration of candidacy|"
                  r"vote center|vote-by-mail ballots|pre-regist|16 years|registration deadline", re.I)


def get(url, limit=3_000_000):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.geturl(), r.headers.get("Content-Type", ""), r.read(limit)
    except urllib.error.HTTPError as e:
        return e.code, url, "", b""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}: {e}", url, "", b""


def text_of(page):
    main = page[page.find("<main"):] if "<main" in page else page
    main = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", main, flags=re.S | re.I)
    main = re.sub(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', lambda m: f"[{re.sub(r'<[^>]+>', '', m.group(2)).strip()}]({m.group(1)})", main, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", main)).replace("\xa0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    return re.sub(r"\n\s*\n+", "\n", t)


def pdf_text(body):
    with open("/tmp/p.pdf", "wb") as f:
        f.write(body)
    return subprocess.run(["pdftotext", "-layout", "/tmp/p.pdf", "-"], capture_output=True, text=True).stdout


seen = set()
follow = []
for url in PAGES:
    status, final, ctype, body = get(url)
    print(f"\n=== {status} {url} -> {final}")
    if not body:
        continue
    page = body.decode("utf-8", "replace")
    t = text_of(page)
    lines = [l.strip() for l in t.split("\n") if l.strip()]
    hits = [i for i, l in enumerate(lines) if KEYS.search(l)]
    shown = set()
    for i in hits[:60]:
        for j in range(max(0, i - 1), min(len(lines), i + 2)):
            if j not in shown:
                shown.add(j)
                print("  |", lines[j][:300])
    for href in re.findall(r'href="([^"]+)"', page):
        full = urllib.parse.urljoin(final, html.unescape(href))
        if "2028" in full and full not in seen and ("sos.ca.gov" in full or "ocvote.gov" in full):
            seen.add(full)
            follow.append(full)

print("\n\n##### links mentioning 2028")
for u in follow[:40]:
    print(u)
for u in follow[:25]:
    status, final, ctype, body = get(u)
    print(f"\n=== {status} {u} ({ctype})")
    if not body:
        continue
    t = pdf_text(body) if ("pdf" in ctype or u.lower().endswith(".pdf")) else text_of(body.decode("utf-8", "replace"))
    lines = [l.strip() for l in t.split("\n") if l.strip()]
    for l in lines[:400]:
        if re.search(r"\b20(27|28)\b|E-\d+|E\+\d+", l):
            print("  |", l[:300])
