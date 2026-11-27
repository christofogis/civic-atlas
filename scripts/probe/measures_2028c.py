"""SB 895: the end of its chaptered PDF (approval and filing dates) and whether the Legislature's
bill pages answer from a runner (for a clean-text digest and the chaptered date). Prints only."""
import html
import re
import subprocess
import urllib.request

BROWSER = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", "Accept": "text/html"}


def get(url, headers):
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.status, r.read(3_000_000)
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}: {e}", b""


status, body = get("https://elections.cdn.sos.ca.gov/ballot-measures/pdf/sb895-ch1040.pdf", {"User-Agent": "civic-atlas measures build (github.com/christofogis/civic-atlas)"})
open("/tmp/m.pdf", "wb").write(body)
print(subprocess.run(["pdfinfo", "/tmp/m.pdf"], capture_output=True, text=True).stdout)
print("fonts:", subprocess.run(["pdffonts", "/tmp/m.pdf"], capture_output=True, text=True).stdout[:800])
out = re.sub(r"\n\s*\n+", "\n", subprocess.run(["pdftotext", "-layout", "/tmp/m.pdf", "-"], capture_output=True, text=True).stdout)
i = out.find("The people of the State of California do enact")
print("=== before enact clause\n", out[max(0, i - 1500): i + 100])
print("=== last 2500\n", out[-2500:])

for url in [
    "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB895",
    "https://leginfo.legislature.ca.gov/faces/billHistoryClient.xhtml?bill_id=202520260SB895",
    "https://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=202520260SB895",
]:
    status, body = get(url, BROWSER)
    print(f"=== {status} {url} ({len(body)} bytes)")
    if status == 200:
        t = html.unescape(re.sub(r"<[^>]+>", "\n", body.decode("utf-8", "replace")))
        t = re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t]+", " ", t))
        for k in ["Chaptered by Secretary of State", "Chapter 1040", "Approved by the Governor", "LEGISLATIVE COUNSEL"]:
            j = t.find(k)
            if j >= 0: print(f"  [{k}]", t[max(0, j - 300): j + 400].replace("\n", " | "))
