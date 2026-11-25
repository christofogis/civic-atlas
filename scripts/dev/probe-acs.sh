#!/usr/bin/env bash
set -u
echo "== status"; curl -s -i "https://api.census.gov/data/2024/acs/acs5?get=NAME,B01003_001E&for=congressional%20district:12&in=state:06" | head -20
echo "== 2023 key-less"; curl -s -o /dev/null -w "%{http_code}\n" "https://api.census.gov/data/2023/acs/acs5?get=NAME&for=state:06"
echo "== datasets 2024"; curl -s "https://api.census.gov/data/2024/acs/acs5.json" | head -c 300; echo
echo "== exec files"; curl -s "https://api.github.com/repos/openstates/people/contents/data/ca/executive" | grep -o '"name":"[^"]*"'
curl -s "https://raw.githubusercontent.com/openstates/people/main/data/ca/executive/$(curl -s https://api.github.com/repos/openstates/people/contents/data/ca/executive | grep -o '"name":"[^"]*Newsom[^"]*"' | head -1 | cut -d'"' -f4)" | head -30
echo "== states with executive dirs"; for s in tx ny fl oh; do curl -s "https://api.github.com/repos/openstates/people/contents/data/$s/executive" | grep -c '"name"'; done
