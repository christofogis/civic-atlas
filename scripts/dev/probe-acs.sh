#!/usr/bin/env bash
set -u
B=https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF
curl -s -o /tmp/geos.txt "$B/documentation/Geos20245YR.txt"
echo "== sumlevels"; cut -d'|' -f3 /tmp/geos.txt | sort | uniq -c | sort -k2 | tr '\n' ' '; echo
echo "== CD rows"; awk -F'|' '$3=="500" && $8=="06"' /tmp/geos.txt | head -2 | cut -c1-250
for sl in 510 511 550 551 552 553 554 555 556 557 558 559 560; do n=$(awk -F'|' -v s=$sl '$3==s' /tmp/geos.txt | wc -l); [ "$n" -gt 0 ] && { echo "sl $sl: $n"; awk -F'|' -v s=$sl '$3==s && $8=="06"' /tmp/geos.txt | head -2 | cut -c1-250; }; done
echo "== data files"; curl -s "$B/data/5YRData/" | grep -oE 'acsdt5y2024-b(01003|01002|19013|25077|15003|17001)\.dat' | sort -u
curl -sI "$B/data/5YRData/acsdt5y2024-b01003.dat" | grep -i content-length
curl -s "$B/data/5YRData/acsdt5y2024-b01003.dat" | head -3 | cut -c1-300
