#!/usr/bin/env bash
# Temporary probe: which Census boundary files exist for the 119th and 120th Congress.
set -u
for u in https://www2.census.gov/geo/tiger/TIGER2026/CD/ https://www2.census.gov/geo/tiger/GENZ2025/shp/ https://www2.census.gov/geo/tiger/GENZ2026/shp/ https://www2.census.gov/geo/tiger/TIGER2025/CD/; do
  echo "== $u"; curl -s -A "civic-atlas probe" "$u" | grep -oE 'href="[^"]*(cd11[89]|cd120|_us_state_|_us_cd)[^"]*"' | sort -u | head -20
done
for u in https://www2.census.gov/geo/tiger/TIGER2026/CD/tl_2026_us_cd120.zip https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_cd119_500k.zip https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_500k.zip; do
  echo "== HEAD $u"; curl -sI -A "civic-atlas probe" "$u" | grep -iE "^HTTP|content-length|last-modified"
done
