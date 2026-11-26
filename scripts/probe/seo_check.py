"""Check the live preview tags and sitemap after a deploy (run in the probe workflow)."""
import re, urllib.request
BASE = "https://civic-atlas-cub.pages.dev"
def get(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "civic-atlas probe"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")
for path in ["/member/P000145", "/bill/119/hr/1", "/committee/HSAG", "/on-the-ballot?lang=es", "/member/Z999999"]:
    status, html = get(path)
    tags = re.findall(r'<(?:title>[^<]*|meta (?:property|name)="(?:og:title|og:description|og:image|twitter:card)"[^>]*|link rel="canonical"[^>]*)', html)
    print(f"== {path} -> {status}")
    for t in tags: print("  ", t[:200])
status, xml = get("/sitemap.xml")
print("== /sitemap.xml ->", status, xml[:400])
