"""Ballot measures for 2028 on the Secretary of State's qualified and eligible pages: every 2028
election heading with the text and links under it, then whether SB 895's official PDFs and the LAO
pages respond. Prints only; writes nothing."""
import html
import re
import subprocess
import urllib.request

UA = {"User-Agent": "civic-atlas measures build (github.com/christofogis/civic-atlas)"}
PAGES = {
    "qualified": "https://www.sos.ca.gov/elections/ballot-measures/qualified-ballot-measures",
    "eligible": "https://www.sos.ca.gov/elections/ballot-measures/initiative-and-referendum-status/eligible-statewide-initiative-measures",
}


def get(url, limit=3_000_000):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read(limit)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}: {e}", b""


for name, url in PAGES.items():
    status, body = get(url)
    print(f"=== {name}: {status} {url}")
    page = body.decode("utf-8", "replace")
    main = page[page.find("<main"):] if "<main" in page else page
    # Links as [text](href) so the sections show which PDFs belong to which measure.
    main = re.sub(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', lambda m: f"[{re.sub(r'<[^>]+>', '', m.group(2)).strip()}]({m.group(1)})", main, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", "\n", main)).replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    for m in re.finditer(r"(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 2028", text):
        print(f"--- heading at {m.start()}: {m.group(0)}")
    first = re.search(r"\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 2028", text)
    if first:
        print(text[max(0, first.start() - 300): first.start() + 9000])
    print()

# SB 895: official text candidates on the Secretary of State's CDN, and the Legislature's bill page.
for url in [
    "https://elections.cdn.sos.ca.gov/ballot-measures/pdf/sb-895.pdf",
    "https://elections.cdn.sos.ca.gov/ballot-measures/pdf/sb-895-ch1040.pdf",
    "https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB895",
    "https://lao.ca.gov/BallotAnalysis/Propositions",
]:
    status, body = get(url, 600_000)
    print(f"{status} {url} ({len(body)} bytes)")
    if url.endswith(".pdf") and status == 200:
        open("/tmp/m.pdf", "wb").write(body)
        out = subprocess.run(["pdftotext", "-layout", "/tmp/m.pdf", "-"], capture_output=True, text=True).stdout
        print(re.sub(r"\n\s*\n+", "\n", out)[:5000])
    if "lao.ca.gov" in url and status == 200:
        t = body.decode("utf-8", "replace")
        for m in re.finditer(r'href="([^"]*BallotDetail[^"]*)"[^>]*>(.*?)</a>', t, re.S):
            print("  LAO", m.group(1), re.sub(r"<[^>]+>|\s+", " ", m.group(2)).strip()[:120])
        for m in re.finditer(r"2028", t):
            print("  ...", re.sub(r"<[^>]+>|\s+", " ", t[max(0, m.start() - 200): m.start() + 200]))
            break
