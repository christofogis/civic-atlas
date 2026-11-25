#!/bin/sh
# Temporary: Registrar city shapefile list. Remove after use.
curl -sL -w "\nHTTP %{http_code}\n" "https://ocvote.gov/bin/maps/shapefiles/php/city_maps.php" | head -c 6000; echo
