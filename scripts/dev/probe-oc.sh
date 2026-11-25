#!/bin/sh
# Temporary: find a countywide source for city council district maps (OC Registrar of Voters). Remove after use.
for q in "Orange County Registrar of Voters city council districts" "ocvote city districts" "OCROV council districts" "Orange County city council districts 2022"; do
  echo "== $q"
  curl -s "https://www.arcgis.com/sharing/rest/search?q=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$q")&f=json&num=15" | python3 -c 'import json,sys; [print(r["title"],"|",r["owner"],"|",r["type"],"|",r.get("url")) for r in json.load(sys.stdin)["results"]]'
done
echo "== ocvote maps-and-gis page"
curl -sL https://ocvote.gov/maps-and-gis | python3 -c 'import sys,re; t=sys.stdin.read(); [print(u) for u in sorted(set(re.findall(r"https?://[^\"<> ]+", t))) if re.search(r"arcgis|gis|shp|zip|download|fileadmin", u, re.I)]' | head -40
curl -sL https://ocvote.gov/maps-and-gis | grep -oiE 'href="/[^"]*"' | sort -u | head -60
