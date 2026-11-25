#!/usr/bin/env bash
set -u
B=https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF
echo "== dirs"; curl -s $B/ | grep -oE 'href="[^"?]+/"' | head; curl -s $B/documentation/ | grep -oE 'href="[^"?]+"' | head -20
curl -s -o /tmp/geos.txt "$B/documentation/Geos20245YR.txt"; ls -la /tmp/geos.txt; head -2 /tmp/geos.txt | cut -c1-400
echo "== CD12 rows"; grep -E "5001900US0612|US0612" /tmp/geos.txt | head -3 | cut -c1-300
echo "== sumlevels"; cut -d'|' -f2 /tmp/geos.txt | sort | uniq -c | sort -rn | head -40
echo "== data dir"; curl -s "$B/data/5YRData/" | grep -oE 'acsdt5y2024-b0100[0-9]\.dat|acsdt5y2024-b19013\.dat|acsdt5y2024-b01002\.dat' | sort -u
curl -sI "$B/data/5YRData/acsdt5y2024-b01003.dat" | grep -i content-length
