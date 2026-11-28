"""Check a deployed build's link previews: each page's og:image and alt text, and that the image
URL returns a 1200x630 image/png. Base URL: the night/trust branch preview unless OG_BASE is set.
Prints only."""
import os, re, struct, urllib.request

BASE = os.environ.get("OG_BASE", "https://night-trust.civic-atlas-cub.pages.dev")
UA = {"User-Agent": "Mozilla/5.0 (compatible; civic-atlas-probe)"}

def get(url, method="GET"):
    req = urllib.request.Request(url, headers=UA, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, dict(r.headers), r.read() if method == "GET" else b""
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()

for path in ["/member/P000145", "/member/G000578", "/member/C001088?lang=es", "/bill/119/hr/1", "/bill/119/hr/504",
             "/bill/119/hr/9999", "/committee/HSAG", "/on-the-ballot?year=2026", "/corrections"]:
    status, headers, body = get(BASE + path)
    html = body.decode("utf-8", "replace")
    tags = dict(re.findall(r'<meta (?:property|name)="((?:og|twitter):[^"]+)" content="([^"]*)"', html))
    title = re.search(r"<title>([^<]*)</title>", html)
    print(f"\n{path}: {status}, title: {title.group(1) if title else None}")
    for k in ["og:image", "og:image:alt", "og:image:type", "og:image:width", "twitter:card"]:
        print(f"  {k}: {tags.get(k)}")
    img = tags.get("og:image")
    if img:
        s, h, b = get(img)
        dims = struct.unpack(">II", b[16:24]) if b[:8] == b"\x89PNG\r\n\x1a\n" else None
        print(f"  image: {s} {h.get('Content-Type')} {len(b)} bytes {dims or ''} cache: {h.get('Cache-Control')}")

s, h, b = get(BASE + "/data/corrections.json")
print(f"\n/data/corrections.json: {s} {h.get('Content-Type')} {len(b)} bytes, entries: {b.count(b'\"shown\"')}")
s, h, b = get(BASE + "/og/cards.json")
print(f"/og/cards.json: {s} {b[:300]}")
s, h, b = get(BASE + "/state/person/00000000-0000-0000-0000-000000000000")
print(f"missing state person: {s}")
