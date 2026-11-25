#!/bin/sh
# Temporary: inspect the Registrar's city and city subdistrict shapefiles. Remove after use.
set -e
npm ci --silent >/dev/null 2>&1
mkdir -p /tmp/rov && cd /tmp/rov
for f in City City_Subdistrict; do curl -sSfL -o $f.zip "https://ocvote.gov/bin/maps/shapefiles/zip/City/$f.zip"; unzip -qo $f.zip -d $f; ls -la $f; done
cd $GITHUB_WORKSPACE
for f in City City_Subdistrict; do shp=$(ls /tmp/rov/$f/*.shp /tmp/rov/$f/*/*.shp 2>/dev/null | head -1); echo "== $shp"; npx mapshaper -i "$shp" -info 2>&1 | head -40; npx mapshaper -i "$shp" -proj wgs84 -o /tmp/rov/$f.json format=geojson 2>&1 | tail -1; done
node -e '
const c=require("/tmp/rov/City_Subdistrict.json"); const by={};
for (const f of c.features){ const p=f.properties; const k=JSON.stringify(p).slice(0,200); by[Object.values(p)[0]]=(by[Object.values(p)[0]]||0)+1 }
console.log(c.features.length); console.log(c.features.slice(0,3).map(f=>f.properties));
console.log(c.features.filter(f=>/alamitos|anaheim/i.test(JSON.stringify(f.properties))).map(f=>f.properties));
'
