"""Which passages of the National Archives Constitution transcription are marked as changed by
later amendments (the page's hyperlinked text), and the paragraph each sits in. Prints only."""
import html
import re
import urllib.request

UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
URL = "https://www.archives.gov/founding-docs/constitution-transcript"
body = urllib.request.urlopen(urllib.request.Request(URL, headers=UA), timeout=60).read().decode("utf-8", "replace")
m = re.search(r"(?is)<main.*?</main>", body)
main = m.group(0) if m else body
clean = lambda s: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s))).strip()
for p in re.findall(r"(?is)<p[^>]*>.*?</p>", main):
    links = re.findall(r'(?is)<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', p)
    links = [(h, clean(t)) for h, t in links]
    if "Section" in clean(p)[:12] or len(clean(p)) < 40: continue
    if links:
        print("PARA:", clean(p)[:120])
        for h, t in links:
            print("   LINK", h, "|", t)
# Spans styled as amended text, if any
for cls in set(re.findall(r'class="([^"]+)"', main)):
    print("class", cls)
