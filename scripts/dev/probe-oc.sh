#!/bin/sh
# Temporary: find Orange County's supervisorial district layer. Remove after use.
B=https://services.arcgis.com/UXmFoWC7yDHcDN5Q/ArcGIS/rest/services
curl -s "$B?f=json" | python3 -c 'import json,sys; [print(s["name"], s["type"]) for s in json.load(sys.stdin)["services"]]' | grep -iE "superv|district|bos|boundar|redistr" | head -40
for s in OC_Boundaries; do curl -s "$B/$s/FeatureServer/layers?f=json" | python3 -c 'import json,sys; d=json.load(sys.stdin); [print(l["id"], l["name"], [f["name"] for f in l["fields"]][:30]) for l in d["layers"]]'; done
