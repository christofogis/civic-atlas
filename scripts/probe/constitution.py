"""Constitution text sources: fetch the National Archives transcriptions and the Constitution
Annotated (constitution.congress.gov) full-text page, and print their text with block breaks, so the
verbatim text and the browse URL pattern can be checked by hand. Prints only."""
import html
import re
import sys
import urllib.request

UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
PAGES = [
    "https://www.archives.gov/founding-docs/constitution-transcript",
    "https://www.archives.gov/founding-docs/bill-of-rights-transcript",
    "https://www.archives.gov/founding-docs/amendments-11-27",
    "https://constitution.congress.gov/constitution/",
]


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.status, r.read().decode("utf-8", "replace")


def text_of(fragment):
    s = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", "", fragment)
    s = re.sub(r"(?i)<br\s*/?>", "\n", s)
    s = re.sub(r"(?i)</?(p|div|h[1-6]|li|ul|ol|section|article|tr|table|blockquote)[^>]*>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    lines = [re.sub(r"[ \t]+", " ", l).strip() for l in s.split("\n")]
    return "\n".join(l for l in lines if l)


for url in PAGES:
    print("=" * 30, url)
    try:
        status, body = get(url)
    except Exception as e:  # noqa: BLE001
        print("ERROR", e)
        continue
    print("status", status, "bytes", len(body))
    if "archives.gov" in url:
        m = re.search(r'(?is)<main.*?</main>', body) or re.search(r'(?is)<div[^>]+id="main-col".*', body)
        print(text_of(m.group(0) if m else body))
    else:
        links = sorted(set(re.findall(r'href="(/browse/[^"#]+)"', body)))
        print("browse links:", len(links))
        for l in links[:400]:
            print("  ", l)
        i = body.find("We the People")
        print("--- raw html around Preamble ---")
        print(body[max(0, i - 3000): i + 6000])
        m = re.search(r'(?is)<main.*?</main>', body)
        print("--- text ---")
        print(text_of(m.group(0) if m else body))
sys.stdout.flush()
