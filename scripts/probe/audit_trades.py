"""Audit: sampled stock-trade rows against the original House PTR PDFs and Senate eFD pages.
Prints only; writes nothing."""
import http.cookiejar, re, subprocess, tempfile, time, urllib.parse, urllib.request

UA = "civic-atlas audit probe"
HOUSE = [("2025/20029026", "Palo Alto"), ("2025/20029034", "FCX"), ("2025/20018054", "UBER"), ("2025/20030902", "PLUG"), ("2025/20024346", "CRWD"),
         ("2026/20034660", "LMT"), ("2025/20029026", "PANW"), ("2025/20030461", "SMFNF"), ("2026/20034159", "TECH"),
         ("2025/20024346", "RMD")]
SENATE = [("7ab0d2fd-19ea-459d-a1d9-3701e2cc8e93", "DELL"), ("9d3510cc-b11b-4777-a8a8-f0a58e886290", "Four Winds"),
          ("fda235b3-bad7-4637-8fa1-053f354d929c", "TAP"), ("63e4a2b1-5bfc-43b6-b952-ba54e377212c", "PYPL"),
          ("1e086831-c7e8-43cd-a11d-dd366a27f400", "AVGO"), ("6826f825-671a-42f4-b367-0c7f571821e9", "LHX"),
          ("2b56957f-6859-43e2-a447-898509c7f142", "DBLEX")]

def get(url, opener=None, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
    with (opener or urllib.request.build_opener()).open(req, timeout=90) as r:
        return r.read()

tmp = tempfile.mkdtemp()
for doc, tick in HOUSE[:1]:
    try:
        pdf = f"{tmp}/{doc.replace('/', '_')}.pdf"
        open(pdf, "wb").write(get(f"https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{doc}.pdf"))
        text = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout
        lines = text.splitlines()
        head = " | ".join(l.strip() for l in lines[:12] if l.strip())[:400]
        print(f"\n### HOUSE {doc} ({tick}) header: {head}")
        for i, l in enumerate(lines):
            if f"({tick})" in l or (" " in tick and tick in l):
                print("\n".join("   " + x for x in lines[max(0, i - 1): i + 3]))
    except Exception as e:
        print("HOUSE", doc, "error", e)

cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
home = get("https://efdsearch.senate.gov/search/home/", op).decode()
tok = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', home).group(1)
try:
    get("https://efdsearch.senate.gov/search/home/", op, urllib.parse.urlencode({"prohibition_agreement": "1", "csrfmiddlewaretoken": tok}).encode(),
        {"Referer": "https://efdsearch.senate.gov/search/home/", "Content-Type": "application/x-www-form-urlencoded"})
except Exception as e:
    print("agreement step:", e)
for uid, tick in [x for x in SENATE if x[1] in ("DELL", "TAP", "PYPL", "AVGO")]:
    time.sleep(8)
    try:
        html = get(f"https://efdsearch.senate.gov/search/view/ptr/{uid}/", op).decode()
        title = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", (re.search(r"<h1[\s\S]*?</h1>", html) or re.search(r"<title>[\s\S]*?</title>", html)).group(0))).strip()
        filed = re.search(r"Filed (\d\d/\d\d/\d{4}[^<]*)", html)
        print(f"\n### SENATE {uid} ({tick}) {title} filed={filed.group(1) if filed else '?'}")
        for tr in re.findall(r"<tr>[\s\S]*?</tr>", html):
            if tick in tr:
                cells = [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", c)).strip() for c in re.findall(r"<td[^>]*>[\s\S]*?</td>", tr)]
                print("   ", cells)
    except Exception as e:
        print("SENATE", uid, "error", e)
