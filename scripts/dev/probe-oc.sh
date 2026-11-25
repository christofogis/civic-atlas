#!/bin/sh
# Temporary: Registrar city shapefile list. Remove after use.
cat /tmp/d.js 2>/dev/null; curl -sL https://ocvote.gov/bin/maps/shapefiles/js/dropdowns.js | head -c 2400; echo
curl -sL "https://ocvote.gov/bin/maps/shapefiles/php/city_maps.php" | head -c 3000; echo
