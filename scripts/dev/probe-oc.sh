#!/bin/sh
# Temporary: inspect Orange County's supervisorial district layer. Remove after use.
B=https://services.arcgis.com/UXmFoWC7yDHcDN5Q/ArcGIS/rest/services/OC_Supervisory_Districts/FeatureServer
curl -s "$B?f=json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("serviceDescription","")[:600]); print([ (l["id"],l["name"]) for l in d.get("layers",[])])'
curl -s "$B/31?f=json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("name"), d.get("description","")[:800]); print([f["name"] for f in d.get("fields",[])]); print(d.get("editingInfo"), d.get("copyrightText"))'
curl -s "$B/31/query?where=1%3D1&outFields=*&returnGeometry=false&f=json" | python3 -c 'import json,sys; d=json.load(sys.stdin); [print(f["attributes"]) for f in d.get("features",[])]'
curl -s "$B/31/query?where=1%3D1&outFields=*&outSR=4326&f=geojson" -o /tmp/sup.geojson; ls -la /tmp/sup.geojson
python3 -c "import json; d=json.load(open(\"/tmp/sup.geojson\")); print(len(d.get(\"features\",[])), [f[\"properties\"] for f in d[\"features\"]][:5])"
