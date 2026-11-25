#!/bin/sh
# Temporary: Los Alamitos 2022 council district layer. Remove after use.
curl -s "https://www.arcgis.com/sharing/rest/content/items/10f7203ba0f74bd48de0d927cb867c36/data?f=json" | python3 -c '
import json,sys
d=json.load(sys.stdin)
for l in d.get("operationalLayers",[]):
    if "Adopted" not in (l.get("title") or ""): continue
    print(json.dumps({k:v for k,v in l.items() if k!="featureCollection"})[:600])
    fc=l.get("featureCollection") or {}
    for s in fc.get("layers",[]):
        fs=s.get("featureSet",{})
        print("geometryType", fs.get("geometryType"), "sr", s.get("layerDefinition",{}).get("spatialReference") or (fs.get("features") or [{}])[0].get("geometry",{}).get("spatialReference"))
        print([f["name"] for f in s.get("layerDefinition",{}).get("fields",[])])
        for f in fs.get("features",[]): print(f["attributes"], len(json.dumps(f["geometry"])))'
