#!/usr/bin/env bash
# Temporary probe: Census ACS by 119th congressional district, and places within a district.
set -u
UA="civic-atlas probe"
for y in 2024 2023; do
  echo "== acs5 $y CD"; curl -s -A "$UA" "https://api.census.gov/data/$y/acs/acs5?get=NAME,B01003_001E,B01002_001E,B19013_001E&for=congressional%20district:12&in=state:06" | head -c 600; echo
done
echo "== geography list"; curl -s -A "$UA" "https://api.census.gov/data/2024/acs/acs5/geography.json" | grep -o '"name":"[^"]*congressional[^"]*"[^}]*"geoLevelDisplay":"[0-9]*"' | head -20
echo "== place (or part) in CD"; curl -s -A "$UA" "https://api.census.gov/data/2024/acs/acs5?get=NAME,B01003_001E&for=place%20(or%20part):*&in=state:06%20congressional%20district:12" | head -c 800; echo
echo "== county (or part) in CD"; curl -s -A "$UA" "https://api.census.gov/data/2024/acs/acs5?get=NAME,B01003_001E&for=county%20(or%20part):*&in=state:06%20congressional%20district:12" | head -c 600; echo
echo "== all CDs count"; curl -s -A "$UA" "https://api.census.gov/data/2024/acs/acs5?get=B01003_001E&for=congressional%20district:*&in=state:*" | wc -l
echo "== openstates people repo"; curl -s -A "$UA" "https://api.github.com/repos/openstates/people/contents/data/ca" | grep '"name"' | head
curl -s -A "$UA" "https://api.github.com/repos/openstates/people/contents/data/ca/executive" | grep '"name"' | head -12
