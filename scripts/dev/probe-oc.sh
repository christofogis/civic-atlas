#!/bin/sh
# Temporary: Registrar shapefile listing. Remove after use.
curl -sL https://ocvote.gov/bin/maps/shapefiles/js/dropdowns.js > /tmp/d.js; wc -c /tmp/d.js
grep -iE "city|council|ward|zip|shp" /tmp/d.js | head -60 | cut -c1-300
curl -sL https://ocvote.gov/bin/maps/shapefiles/ | grep -iE -B2 -A8 "city-shapefiles" | head -60 | cut -c1-300
