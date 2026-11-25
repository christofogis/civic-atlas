#!/bin/sh
# Temporary: find city boundary and Los Alamitos council district layers. Remove after use.
B=https://services.arcgis.com/UXmFoWC7yDHcDN5Q/ArcGIS/rest/services
curl -s "$B?f=json" | python3 -c 'import json,sys; [print(s["name"]) for s in json.load(sys.stdin)["services"]]' | grep -iE "city|council|alamitos|ward" | head -30
for s in City_Boundaries OC_Cities_Land_Boundaries; do echo "== $s"; curl -s "$B/$s/FeatureServer?f=json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print([(l["id"],l["name"]) for l in d.get("layers",[])])'; done
L=$(curl -s "$B/City_Boundaries/FeatureServer?f=json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["layers"][0]["id"])')
curl -s "$B/City_Boundaries/FeatureServer/$L?f=json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print([f["name"] for f in d["fields"]], d.get("editingInfo"), d.get("description","")[:300])'
curl -s "$B/City_Boundaries/FeatureServer/$L/query?where=1%3D1&outFields=*&returnGeometry=false&f=json&resultRecordCount=3" | head -c 1500; echo
echo "== ArcGIS Online search"
curl -s "https://www.arcgis.com/sharing/rest/search?q=Los%20Alamitos%20council%20districts&f=json&num=15" | python3 -c 'import json,sys; [print(r["title"],"|",r["owner"],"|",r["type"],"|",r.get("url")) for r in json.load(sys.stdin)["results"]]'
echo "== ocvote maps page links"
curl -sL https://ocvote.gov/maps | grep -oiE 'href="[^"]*(city|ward|district|shp|zip|gis)[^"]*"' | sort -u | head -40
