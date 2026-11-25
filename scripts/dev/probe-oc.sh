#!/bin/sh
# Temporary: Los Alamitos 2022 council district layer. Remove after use.
curl -s "https://www.arcgis.com/sharing/rest/content/items/10f7203ba0f74bd48de0d927cb867c36/data?f=json" | python3 -c '
import json,sys
d=json.load(sys.stdin)
for l in d.get("operationalLayers",[]):
    print(l.get("title"),"|",l.get("url"),"|",l.get("itemId"))
    for s in l.get("layers",[]) or []: print("   ",s.get("title"),s.get("url"))'
curl -s "https://www.arcgis.com/sharing/rest/content/items/10f7203ba0f74bd48de0d927cb867c36?f=json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("title"), d.get("modified"), d.get("snippet"), d.get("description","")[:400])'
