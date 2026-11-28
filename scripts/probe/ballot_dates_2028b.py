"""Second look for official 2028 dates: the full text and links of the Secretary of State's upcoming
elections page and registration-deadline table, the Registrar's elections and candidates pages, and
guessed calendar addresses. Prints only; writes nothing."""
import html
import re
import urllib.parse
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (civic-atlas date check)"}


def get(url, limit=3_000_000):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.geturl(), r.read(limit).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, url, ""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}: {e}", url, ""


def text_of(page):
    main = page[page.find("<main"):] if "<main" in page else page
    main = re.sub(r"<(script|style|nav|footer)[^>]*>.*?</\1>", " ", main, flags=re.S | re.I)
    main = re.sub(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', lambda m: f"[{re.sub(r'<[^>]+>', '', m.group(2)).strip()}]({m.group(1)})", main, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", main)).replace("\xa0", " ")
    t = re.sub(r"[ \t]+", " ", t)
    return [l.strip() for l in t.split("\n") if l.strip()]


FULL = [
    ("https://www.sos.ca.gov/elections/upcoming-elections", 120),
    ("https://ocvote.gov/elections/", 150),
    ("https://ocvote.gov/candidates", 150),
]
for url, n in FULL:
    s, final, page = get(url)
    print(f"\n=== {s} {url} -> {final}")
    for l in text_of(page)[:n]:
        print("  |", l[:250])

s, final, page = get("https://www.sos.ca.gov/elections/voter-registration")
i = page.find("Voter Registration Deadlines for Upcoming Elections")
print("\n=== registration deadline table")
for l in text_of(page[i:i + 6000])[:40]:
    print("  |", l[:250])

GUESS = [
    "https://www.sos.ca.gov/elections/upcoming-elections/presidential-primary-election-march-7-2028",
    "https://www.sos.ca.gov/elections/upcoming-elections/2028-presidential-primary-election",
    "https://www.sos.ca.gov/elections/upcoming-elections/march-7-2028-presidential-primary-election",
    "https://www.sos.ca.gov/elections/upcoming-elections/presidential-primary-march-7-2028",
    "https://www.sos.ca.gov/elections/prior-elections",
    "https://www.sos.ca.gov/elections/election-calendars",
    "https://www.sos.ca.gov/elections/upcoming-elections/general-election-nov-3-2026",
    "https://ocvote.gov/elections/upcoming-elections",
    "https://ocvote.gov/candidates/candidate-information",
    "https://ocvote.gov/voting/vote-by-mail-voting",
    "https://ocvote.gov/registration/conditional-voter-registration",
    "https://caearlyvoting.sos.ca.gov/",
]
for u in GUESS:
    s, final, page = get(u)
    lines = text_of(page) if page else []
    hits = [l for l in lines if re.search(r"2027|2028|calendar|E-\d+|nomination|filing|days before", l, re.I)]
    print(f"\n=== {s} {u} -> {final} ({len(lines)} lines)")
    for l in hits[:30]:
        print("  |", l[:250])
