import urllib.request
for path in ["/", "/your-week"]:
    html = urllib.request.urlopen(urllib.request.Request("https://civic-atlas-cub.pages.dev" + path, headers={"User-Agent": "Mozilla/5.0 civic-atlas probe"}), timeout=30).read().decode()
    print(path, "beacon present" if "cloudflareinsights" in html else "NO BEACON")
