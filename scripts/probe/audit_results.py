"""Audit: sampled federal election results (public/data/results) against the House Clerk's
election statistics PDFs (2022 file is built from the FEC workbook, so this is an independent check;
2024 file is built from the Clerk PDF, so this checks the parser). Also checks whether the FEC's
2024 workbook is out. Prints only."""
import re, subprocess, tempfile, unicodedata, urllib.request
SAMPLE = [{"y": 2022, "st": "MN", "o": "H", "d": 4, "sp": false, "tv": 295973, "c": [["McCollum, Betty", "DFL", 200055, 67.59, true], ["Xiong, May Lor", "R", 95493, 32.26, false], ["Scattered", "W", 425, 0.14, false]]}, {"y": 2022, "st": "CA", "o": "H", "d": 22, "sp": false, "tv": 102856, "c": [["Valadao, David G.", "R", 52994, 51.52, true], ["Salas, Rudy", "D", 49862, 48.48, false]]}, {"y": 2022, "st": "FL", "o": "H", "d": 6, "sp": false, "tv": 300755, "c": [["Waltz, Michael", "R", 226548, 75.33, true], ["Hannoush, Joseph \"Joe\"", "LBF", 74207, 24.67, false]]}, {"y": 2022, "st": "NY", "o": "H", "d": 23, "sp": true, "tv": 74424, "c": [["Sempolinski, Joseph", "R / CRV", 39128, 52.57, true], ["Della Pia, Max H.", "D / WF", 35075, 47.13, false], ["Scattered", "W", 221, 0.3, false]]}, {"y": 2022, "st": "AZ", "o": "H", "d": 4, "sp": false, "tv": 265498, "c": [["Stanton, Greg", "D", 148941, 56.1, true], ["Cooper, Kelly", "R", 116521, 43.89, false], ["Jones, Stephan \"Steve\"", "W", 36, 0.01, false]]}, {"y": 2022, "st": "CA", "o": "H", "d": 34, "sp": false, "tv": 121467, "c": [["Gomez, Jimmy", "D", 62244, 51.24, true], ["Kim, David", "D", 59223, 48.76, false]]}, {"y": 2022, "st": "KS", "o": "H", "d": 4, "sp": false, "tv": 228740, "c": [["Estes, Ron", "R", 144889, 63.34, true], ["Hernandez, Bob", "D", 83851, 36.66, false]]}, {"y": 2022, "st": "TX", "o": "H", "d": 7, "sp": false, "tv": 181829, "c": [["Fletcher, Lizzie", "D", 115994, 63.79, true], ["Teague, Johnny", "R", 65835, 36.21, false]]}, {"y": 2022, "st": "NJ", "o": "H", "d": 10, "sp": false, "tv": 129707, "c": [["Payne, Donald M., Jr.", "D", 100710, 77.64, true], ["Pinckney, David H.", "R", 25993, 20.04, false], ["Johnson, Cynthia A.", "JAJ", 1989, 1.53, false], ["Ludden, Kendal", "LIB", 634, 0.49, false], ["Childress, Clenard Howard, Jr.", "TMP", 381, 0.29, false]]}, {"y": 2022, "st": "NJ", "o": "H", "d": 5, "sp": false, "tv": 265943, "c": [["Gottheimer, Josh", "D", 145559, 54.73, true], ["Pallota, Frank T.", "R", 117873, 44.32, false], ["Marcus, Jeremy", "LIB", 1193, 0.45, false], ["Ferrigno, Trevor James", "TWS", 700, 0.26, false], ["Vellucci, Louis", "AV", 618, 0.23, false]]}, {"y": 2024, "st": "NY", "o": "H", "d": 5, "sp": false, "tv": 231736, "c": [["Paul King", "Republican / Conservative, Common Sense", 62529, 26.98, null], ["Gregory W. Meeks", "Democrat", 168425, 72.68, null], ["Scattering", null, 782, 0.34, null]]}, {"y": 2024, "st": "CT", "o": "H", "d": 3, "sp": false, "tv": 328923, "c": [["Michael Massey", "Republican / Independent", 135113, 41.08, null], ["Rosa L. DeLauro", "Democrat", 193684, 58.88, null], ["Shahd Omar", "Write-in", 124, 0.04, null], ["Omar Scott Antar", "Write-in", 2, 0.0, null]]}, {"y": 2024, "st": "PA", "o": "H", "d": 4, "sp": false, "tv": 455523, "c": [["David Winkler", "Republican", 186457, 40.93, null], ["Madeleine Dean", "Democrat", 269066, 59.07, null]]}, {"y": 2024, "st": "FL", "o": "H", "d": 20, "sp": false, "tv": null, "c": [["Sheila Cherfilus-McCormick", "Democrat", null, null, null]]}, {"y": 2024, "st": "AL", "o": "H", "d": 6, "sp": false, "tv": 346625, "c": [["Gary J. Palmer", "Republican", 243741, 70.32, null], ["Elizabeth Anderson", "Democrat", 102504, 29.57, null], ["Write-in", null, 380, 0.11, null]]}, {"y": 2024, "st": "NY", "o": "H", "d": 7, "sp": false, "tv": 221779, "c": [["Bill Kregler", "Republican / Conservative", 48435, 21.84, null], ["Nydia M. Velázquez", "Democrat / Working Families", 172795, 77.91, null], ["Scattering", null, 549, 0.25, null]]}, {"y": 2024, "st": "TX", "o": "H", "d": 18, "sp": false, "tv": 218720, "c": [["Lana Centonze", "Republican", 66810, 30.55, null], ["Sylvester Turner", "Democrat", 151834, 69.42, null], ["Vince Duncan", "Write-in", 62, 0.03, null], ["Kevin Dural", "Write-in", 14, 0.01, null]]}, {"y": 2024, "st": "MO", "o": "H", "d": 5, "sp": false, "tv": 331929, "c": [["Sean E. Smith", "Republican", 120957, 36.44, null], ["Emanuel Cleaver", "Democrat", 199900, 60.22, null], ["William Truman “Bill” Wayne", "Libertarian", 6658, 2.01, null], ["Michael Day", "Green", 4414, 1.33, null]]}, {"y": 2024, "st": "TX", "o": "H", "d": 32, "sp": false, "tv": 232464, "c": [["Darrell Day", "Republican", 85941, 36.97, null], ["Julie Johnson", "Democrat", 140536, 60.45, null], ["Kevin A. Hale", "Libertarian", 5987, 2.58, null]]}, {"y": 2024, "st": "AS", "o": "H", "d": 0, "sp": false, "tv": 9888, "c": [["Aumua Amata Coleman Radewagen", "Republican", 7394, 74.78, null], ["Luisa Kuaea", "Democrat", 1840, 18.61, null], ["Meleagi Suitonu-Chapman", "Democrat", 185, 1.87, null], ["Fualaau Rosie Tago Lancaster", "Independent", 469, 4.74, null]]}]
UA = {"User-Agent": "civic-atlas audit probe"}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=180).read()
def norm(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
tmp = tempfile.mkdtemp()
texts = {}
for y in (2022, 2024):
    p = f"{tmp}/{y}.pdf"
    open(p, "wb").write(get(f"https://clerk.house.gov/member_info/electionInfo/{y}/statistics{y}.pdf"))
    texts[y] = subprocess.run(["pdftotext", "-layout", p, "-"], capture_output=True, text=True).stdout.splitlines()
    print(y, "clerk lines", len(texts[y]))
ok = bad = 0
for r in SAMPLE:
    lines = texts[r["y"]]
    print(f"\n## {r['y']} {r['st']}-{r['d']} special={r['sp']} total={r['tv']}")
    for name, party, votes, pct, win in r["c"]:
        if votes is None:
            print("   (no votes)", name); continue
        v = f"{votes:,}"
        last = norm(name.split(",")[0] if "," in name else name.split()[-1]).split()[-1].strip('"')
        hits = [i for i, l in enumerate(lines) if re.search(r"(?<![\d,])" + re.escape(v) + r"(?![\d,])", l)]
        near = [i for i in hits if any(last in norm(lines[j]) for j in range(max(0, i - 2), min(len(lines), i + 3)))]
        if near:
            ok += 1; print("   OK ", name, v)
        else:
            bad += 1; print("   ?? ", name, v, "hits", len(hits), "| lines w/ name:", [lines[j].strip()[:110] for j, l in enumerate(lines) if last in norm(l)][:4])
print("\nmatched", ok, "unmatched", bad)
try:
    page = get("https://www.fec.gov/introduction-campaign-finance/election-results-and-voting-information/").decode("utf8", "ignore")
    print("FEC index mentions 2024 publication:", "federal-elections-2024" in page, sorted(set(re.findall(r"federal-elections-(\d{4})", page))))
except Exception as e:
    print("FEC index error", e)
