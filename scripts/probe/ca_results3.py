"""Learn the layout of the Secretary of State's Statement of Vote spreadsheets (2022 general, which had
the same statewide offices as 2026), and check whether the 2026 Statement of Vote is posted. Prints only."""
import io, re, sys, urllib.request, urllib.error, zipfile, xml.etree.ElementTree as ET

UA = {"User-Agent": "civic-atlas probe (non-commercial civic site)"}
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def get(u):
    try:
        with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b""
    except Exception as e:
        return "ERR " + str(e), b""


def rows(data):
    z = zipfile.ZipFile(io.BytesIO(data))
    names = z.namelist()
    ss = []
    if "xl/sharedStrings.xml" in names:
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", NS):
            ss.append("".join(t.text or "" for t in si.iter("{%s}t" % NS["m"])))
    sheets = sorted(n for n in names if n.startswith("xl/worksheets/sheet"))
    print("  sheets:", sheets)
    for c in ET.fromstring(z.read(sheets[0])).iter("{%s}row" % NS["m"]):
        out = []
        for cell in c.findall("m:c", NS):
            v = cell.find("m:v", NS)
            t = cell.get("t")
            if t == "s" and v is not None:
                out.append(ss[int(v.text)])
            elif t == "inlineStr":
                out.append("".join(x.text or "" for x in cell.iter("{%s}t" % NS["m"])))
            else:
                out.append(v.text if v is not None else "")
        yield [cell.get("r") for cell in c.findall("m:c", NS)], out


for u in ["https://elections.cdn.sos.ca.gov/sov/2022-general/sov/csv-candidates.xlsx",
          "https://elections.cdn.sos.ca.gov/sov/2022-general/sov/csv-all-candidates.xlsx",
          "https://elections.cdn.sos.ca.gov/sov/2024-general/sov/csv-all-candidates.xlsx",
          "https://elections.cdn.sos.ca.gov/sov/2024-general/sov/csv-ballot-measures.xlsx",
          "https://elections.cdn.sos.ca.gov/sov/2022-general/sov/csv-ballot-measures.xlsx"]:
    s, b = get(u)
    print("==", u, s, len(b))
    if s != 200:
        continue
    contests = {}
    for i, (refs, r) in enumerate(rows(b)):
        if i < 6:
            print("  row", i, refs[:12], r[:14])
        if i >= 1 and r:
            key = tuple(r[:4])
            contests.setdefault(r[0] if r else "", 0)
            contests[r[0]] += 1
    print("  first-column values:", len(contests), list(contests.items())[:40])

s, b = get("https://elections.cdn.sos.ca.gov/sov/2022-general/sov/csv-candidates.xlsx")
for u in ["https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/general-election-nov-8-2022/statement-vote",
          "https://www.sos.ca.gov/elections/upcoming-elections/general-election-november-3-2026",
          "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/general-election-november-3-2026/statement-vote",
          "https://www.sos.ca.gov/elections/prior-elections/statewide-election-results/general-election-nov-3-2026/statement-vote"]:
    s, h = get(u)
    h = h.decode("utf8", "replace")
    print("PAGE", u, s, len(h))
    for m in sorted(set(re.findall(r'href="([^"]+)"', h))):
        if re.search(r"csv|\.xlsx|statement|sov|result|certif|canvass", m, re.I):
            print("   link:", m)
    t = " ".join(re.sub(r"<[^>]+>", " ", h).split())
    for kw in ["certif", "Statement of Vote", "semi-official", "canvass"]:
        i = t.find(kw)
        if i >= 0:
            print("   txt:", t[max(0, i - 150): i + 200])

for u in ["https://elections.cdn.sos.ca.gov/sov/2026-general/sov/csv-all-candidates.xlsx",
          "https://elections.cdn.sos.ca.gov/sov/2026-general/sov/csv-candidates.xlsx",
          "https://elections.cdn.sos.ca.gov/sov/2026-general/sov/csv-ballot-measures.xlsx",
          "https://elections.cdn.sos.ca.gov/sov/2026-general/sov/15-sov-certificate.pdf"]:
    s, b = get(u)
    print("CDN", u, s, len(b))
