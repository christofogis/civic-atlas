"""Run scripts/data/ca_results.py on the runner and print its output file (the build workflow can't be
dispatched until it's on main). Writes only inside the runner's checkout, which is discarded."""
import runpy, sys
sys.argv = ["ca_results.py"]
runpy.run_path("scripts/data/ca_results.py", run_name="__main__")
print("=====JSON=====")
print(open("public/data/state/ca-results-2026.json", encoding="utf8").read())
