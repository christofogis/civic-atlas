#!/bin/sh
# Temporary: find city boundary and Los Alamitos council district layers. Remove after use.
B=https://services.arcgis.com/UXmFoWC7yDHcDN5Q/ArcGIS/rest/services/OC_Cities_Land_Boundaries/FeatureServer/0
curl -s "$B?f=json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print([f["name"] for f in d["fields"]], d.get("editingInfo"))'
curl -s "$B/query?where=1%3D1&outFields=*&returnGeometry=false&f=json" | python3 -c 'import json,sys; d=json.load(sys.stdin); fs=d.get("features",[]); print(len(fs)); [print(f["attributes"]) for f in fs if "lamitos" in json.dumps(f["attributes"]).lower() or "rossmoor" in json.dumps(f["attributes"]).lower()]; print(fs[0]["attributes"] if fs else d)'
echo "== ArcGIS Online feature services"
curl -s "https://www.arcgis.com/sharing/rest/search?q=Los%20Alamitos%20owner%3ANDCuser1&f=json&num=30" | python3 -c 'import json,sys; [print(r["title"],"|",r["type"],"|",r.get("url"),"|",r["id"]) for r in json.load(sys.stdin)["results"]]'
echo "== ocvote maps-and-gis links"
curl -sL https://ocvote.gov/maps-and-gis | grep -oiE 'href="[^"]*"' | grep -iE "city|ward|council|shp|zip|gis|arcgis|district" | sort -u | head -60
