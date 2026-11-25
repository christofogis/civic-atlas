#!/bin/sh
# Temporary: Registrar shapefile listing. Remove after use.
curl -sL https://ocvote.gov/bin/maps/shapefiles/ > /tmp/s.html
python3 -c 'import re; t=open("/tmp/s.html").read(); print(sorted(set(re.findall(r"[\w./:-]*\.(?:zip|kmz|json|js)\b", t))))'
grep -oiE "(city|council|ward|subdistrict)[^<\"]{0,80}" /tmp/s.html | sort -u | head -40
for f in $(python3 -c 'import re; t=open("/tmp/s.html").read(); print(" ".join(sorted(set(u for u in re.findall(r"src=\"([^\"]+\.js)\"", t) if not u.startswith("http")))))'); do echo "== $f"; curl -sL "https://ocvote.gov/bin/maps/shapefiles/$f" | grep -oE "[A-Za-z0-9_/.-]*\.(zip|kmz)" | sort -u | head -80; done
