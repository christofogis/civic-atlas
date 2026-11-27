"""Audit follow-up: print the Clerk's lines for fusion candidates and other unmatched names. Prints only."""
import subprocess, tempfile, urllib.request
UA = {"User-Agent": "civic-atlas audit probe"}
WANT = {2022: ["Della Pia", "Sempolinski", "Pallot", "May Lor Xiong"], 2024: ["Paul King", "Michael Massey", "Bill Kregler", "Nydia M. Vel"]}
tmp = tempfile.mkdtemp()
for y, names in WANT.items():
    p = f"{tmp}/{y}.pdf"
    open(p, "wb").write(urllib.request.urlopen(urllib.request.Request(f"https://clerk.house.gov/member_info/electionInfo/{y}/statistics{y}.pdf", headers=UA), timeout=180).read())
    lines = subprocess.run(["pdftotext", "-layout", p, "-"], capture_output=True, text=True).stdout.splitlines()
    for n in names:
        for i, l in enumerate(lines):
            if n in l:
                print(f"--- {y} {n} @{i}")
                print("\n".join("   " + x.rstrip()[:160] for x in lines[max(0, i - 2): i + 8]))
