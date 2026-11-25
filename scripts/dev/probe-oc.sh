#!/bin/sh
# Temporary: Registrar of Voters shapefile directory. Remove after use.
curl -sL https://ocvote.gov/bin/maps/shapefiles/ | python3 -c 'import sys,re; t=sys.stdin.read(); print(len(t)); [print(u) for u in re.findall(r"href=\"([^\"]+)\"", t)][:80]' | head -80
echo "== downloads page"
curl -sL https://ocvote.gov/bin/maps/map_downloads.html | python3 -c 'import sys,re; t=sys.stdin.read(); print(len(t)); [print(u) for u in sorted(set(re.findall(r"href=\"([^\"]+)\"", t))) if re.search(r"city|council|ward|shp|zip", u, re.I)]' | head -60
