# Dry run of the 120th Congress transition (Jan 3, 2027) against the live database, read-only:
#  1. seat_holders_on(as_of) for Jan 2 and Jan 4, 2027: nobody "serving" past their term's end.
#  2. A local build of this branch, served by vite preview, with key pages rendered in a browser
#     whose clock is set to Jan 4, 2027 (and Dec 6/8, 2026 for the California Legislature).
# Prints only; writes nothing. Run with the probe workflow: inputs[script]=transition_2027.py
import json, os, re, subprocess, sys, time, urllib.request

root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cfg = open(os.path.join(root, "src/lib/config.js")).read()
URL = re.search(r'SUPABASE_URL = "([^"]+)"', cfg).group(1)
KEY = re.search(r'SUPABASE_PUBLISHABLE_KEY = "([^"]+)"', cfg).group(1)

def rest(path):
    req = urllib.request.Request(f"{URL}/rest/v1/{path}", headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

problems = 0
for as_of in ["2027-01-02", "2027-01-03", "2027-01-04", "2027-02-03"]:
    rows = rest(f"rpc/seat_holders_on?as_of={as_of}&select=bioguide_id,chamber,state,district,senate_class,end_date,seat_status")
    serving = [r for r in rows if r["seat_status"] == "serving"]
    bad = [r for r in serving if r["end_date"] <= as_of]
    by = {}
    for r in rows:
        by[(r["chamber"], r["seat_status"])] = by.get((r["chamber"], r["seat_status"]), 0) + 1
    print(f"seat_holders_on({as_of}): {len(rows)} seats; " + ", ".join(f"{c} {s}: {n}" for (c, s), n in sorted(by.items())))
    for r in bad:
        problems += 1
        print(f"  FAIL serving past term end: {r}")
oh = rest("rpc/seat_holders_on?as_of=2027-01-04&state=eq.OH&chamber=eq.senate&select=bioguide_id,senate_class,seat_status,end_date")
print(f"Ohio Senate seats on 2027-01-04: {oh}")
lead = rest("leadership_roles?select=chamber,title,start_date,end_date&or=(end_date.is.null,end_date.gt.2027-01-04)")
started_120 = [r for r in lead if r["start_date"] >= "2027-01-03"]
print(f"leadership roles open on 2027-01-04: {len(lead)}; begun in the 120th: {len(started_120)} (0 until congress-legislators updates)")
cong = rest("congresses?select=number,start_date,end_date&order=number")
print(f"congresses: {cong}")
for t in ["lower", "upper"]:
    n = rest(f"state_roles?state=eq.CA&type=eq.{t}&start_date=gte.2026-12-07&select=person_id")
    print(f"CA {t}: roles starting on/after 2026-12-07 in Open States so far: {len(n)}")

def run(cmd, **kw):
    print(f"$ {' '.join(cmd)}", flush=True)
    return subprocess.run(cmd, cwd=root, check=True, **kw)

print(subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip(), flush=True)
run(["npm", "ci", "--no-audit", "--no-fund", "--loglevel=error"])
run(["npx", "playwright", "install", "--with-deps", "chromium"], stdout=subprocess.DEVNULL)
run(["npm", "run", "build", "--silent"], stdout=subprocess.DEVNULL)
server = subprocess.Popen(["npx", "vite", "preview", "--port", "4173", "--strictPort"], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(60):
        try:
            urllib.request.urlopen("http://localhost:4173/", timeout=2)
            break
        except Exception:
            time.sleep(1)
    r = subprocess.run(["node", "scripts/probe/transition_2027_render.mjs", "http://localhost:4173"], cwd=root, capture_output=True, text=True)
    print(r.stdout)
    print(r.stderr[-3000:])
    if "check(s) failed" in r.stdout or r.returncode:
        problems += 1
finally:
    server.terminate()
print("DRY RUN: problems found" if problems else "DRY RUN: no problems found")
sys.exit(1 if problems else 0)
