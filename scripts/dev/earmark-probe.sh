#!/usr/bin/env bash
# Developer probe: what format are the enacted earmark tables in? Writes nothing to the database.
set -u
UA="Mozilla/5.0 (civic-atlas data probe; github.com/christofogis/civic-atlas)"
mkdir -p /tmp/ep && cd /tmp/ep
for y in 2024 2026; do
  page="https://www.appropriations.senate.gov/fy-${y}-congressionally-directed-spending"
  curl -sL -A "$UA" "$page" -o page$y.html
  echo "== FY$y page $(wc -c < page$y.html) bytes"
  grep -oE 'href="[^"]*(download/[^"]*|\.pdf|\.xlsx)"' page$y.html | sed 's/href="//;s/"$//' | sort -u | tee links$y.txt
done
n=0
for url in $(grep -hE 'public-law|_pl|enacted' links2024.txt links2026.txt | sed 's#^/#https://www.appropriations.senate.gov/#' | head -4) \
           https://www.appropriations.senate.gov/download/fy26-thud-cds-public-law \
           https://appropriations.house.gov/sites/evo-subsites/republicans-appropriations.house.gov/files/evo-media-document/fy26-house-cpf-consolidated.xlsx; do
  n=$((n+1)); curl -sL -A "$UA" "$url" -o f$n -D h$n
  echo; echo "== $url"; grep -i '^content-type\|^content-disposition' h$n; file f$n; ls -l f$n | awk '{print $5" bytes"}'
  case "$(file -b f$n)" in
    PDF*) pdftotext -layout f$n - | head -45 ;;
    *Excel*|*Zip*|*OOXML*) python3 -c "
import openpyxl,sys; wb=openpyxl.load_workbook('f$n',read_only=True)
for ws in wb.worksheets[:3]:
  print('# sheet',ws.title,ws.max_row,'rows')
  for r in list(ws.iter_rows(values_only=True))[:8]: print(r)" ;;
  esac
done
