"""SB 895's chaptered text (for the build's digest extraction and the chaptered date), the eligible
page's text around 2028, and the LAO's ballot analyses list. Prints only; writes nothing."""
import html
import re
import subprocess
import urllib.request

UA = {"User-Agent": "civic-atlas measures build (github.com/christofogis/civic-atlas)"}


def get(url, limit=3_000_000):
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read(limit)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}: {e}", b""


def text_of(body):
    page = body.decode("utf-8", "replace")
    main = page[page.find("<main"):] if "<main" in page else page
    main = re.sub(r'<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>', lambda m: f"[{re.sub(r'<[^>]+>', '', m.group(2)).strip()}]({m.group(1)})", main, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", main)).replace("\xa0", " ")
    return re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t]+", " ", t))


url = "https://elections.cdn.sos.ca.gov/ballot-measures/pdf/sb895-ch1040.pdf"
status, body = get(url)
print(f"=== {status} {url} ({len(body)} bytes)")
if status == 200:
    open("/tmp/m.pdf", "wb").write(body)
    out = subprocess.run(["pdftotext", "-layout", "/tmp/m.pdf", "-"], capture_output=True, text=True).stdout
    out = re.sub(r"\n\s*\n+", "\n", out)
    print(out[:9000])
    i = out.find("The people of the State of California do enact")
    print("--- enact at", i, "; 'Vote:' at", out.find("Vote:"))

for url in ["https://www.sos.ca.gov/elections/ballot-measures/initiative-and-referendum-status/eligible-statewide-initiative-measures"]:
    status, body = get(url)
    t = text_of(body)
    print(f"=== {status} {url}")
    for m in re.finditer(r"2028", t):
        print("...", t[max(0, m.start() - 400): m.start() + 600].replace("\n", " | "))
        print()

status, body = get("https://lao.ca.gov/BallotAnalysis/Propositions")
t = text_of(body)
print("=== LAO propositions", status)
i = t.find("2028")
print(t[max(0, i - 500): i + 2500] if i >= 0 else t[:2500])
status, body = get("https://lao.ca.gov/BallotAnalysis/Initiatives")
t = text_of(body)
print("=== LAO initiatives", status)
for m in re.finditer(r"(?i)science|895|bond act", t):
    print("...", t[max(0, m.start() - 200): m.start() + 300].replace("\n", " | "))
