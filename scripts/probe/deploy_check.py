"""Which build is live: looks for the style-test light switch in production and the latest preview."""
import re, urllib.request
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "civic-atlas-probe"}), timeout=30).read().decode("utf-8", "replace")
for base in ["https://civic-atlas-cub.pages.dev", "https://3af33c47.civic-atlas-cub.pages.dev"]:
    html = get(base + "/style-test")
    js = re.findall(r'src="(/assets/[^"]+\.js)"', html)
    print(base, js)
    for j in js:
        body = get(base + j)
        names = re.findall(r'"(/?assets/StyleTest[^"]*\.js)"|(StyleTest-[\w-]+\.js)', body)
        print(" main has slate-light:", "slate-light" in body, "chunks:", names[:3])
        for n in {a or b for a, b in names}:
            c = get(base + "/assets/" + n.split("/")[-1])
            print(" ", n, "slate-light" in c, "preview of a darker" in c)
