"""Run scripts/data/election_results.py as the monthly job does (its files stay on the runner) and
print the files it wrote as gzipped base64, plus a few checks, so the first build can be reviewed."""
import base64, glob, gzip, json, runpy, sys
sys.argv = ["election_results.py"]
runpy.run_path("scripts/data/election_results.py", run_name="__main__")
for f in sorted(glob.glob("public/data/results/*.json")):
    d = json.load(open(f))
    if "races" in d:
        rs = d["races"]
        print("CHECK", f, d["source"], len(rs), "races;",
              sum(bool(c["fec_ids"]) for r in rs for c in r["candidates"]), "candidates with FEC IDs of",
              sum(1 for r in rs for c in r["candidates"]))
    b = base64.b64encode(gzip.compress(open(f, "rb").read(), 9)).decode()
    print("BEGIN", f)
    for i in range(0, len(b), 76): print(b[i:i + 76])
    print("END", f)
