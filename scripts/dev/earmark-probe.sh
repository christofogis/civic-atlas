#!/usr/bin/env bash
# Developer probe: what format are the enacted earmark tables in? Writes nothing to the database.
set -u
UA="civic-atlas data probe (github.com/christofogis/civic-atlas)"
mkdir -p /tmp/ep && cd /tmp/ep
show() {  # url name
  curl -sL -A "$UA" "$1" -o "$2" -D "$2.h"
  echo; echo "== $1"; grep -i '^content-type\|^content-disposition\|^location' "$2.h"; file "$2"; ls -l "$2" | awk '{print $5" bytes"}'
  case "$(file -b "$2")" in
    PDF*) pdfinfo "$2" | grep -i 'pages\|title'; pdftotext -layout -f 1 -l 2 "$2" - | head -60 ;;
    *Excel*|*Zip*|*OOXML*) cp "$2" "$2.xlsx"; python3 -c "
import openpyxl; wb=openpyxl.load_workbook('$2.xlsx',read_only=True)
for ws in wb.worksheets[:3]:
  print('# sheet',ws.title,ws.max_row,'rows')
  for r in list(ws.iter_rows(values_only=True))[:6]: print(r)" ;;
    HTML*) grep -oiE '<title>[^<]*|http-equiv="refresh"[^>]*|href="[^"]*\.(pdf|xlsx)"' "$2" | head -8 ;;
  esac
}
show https://www.appropriations.senate.gov/download/fy26-thud-cds-public-law a
show https://www.appropriations.senate.gov/imo/media/doc/fy24_thud_cds_table_updated.pdf b
show https://www.appropriations.senate.gov/imo/media/doc/fy24_lhhs_cds_table.pdf c
show https://appropriations.house.gov/sites/evo-subsites/republicans-appropriations.house.gov/files/evo-media-document/fy26-house-cpf-consolidated.xlsx d
curl -sL -A "$UA" https://www.appropriations.senate.gov/fy-2024-congressionally-directed-spending | sed 's/<[^>]*>/ /g' | grep -iE 'public law|P\.L\.|enacted|funded|included in' | sed 's/  */ /g' | head -20
