"""Second pass of audit_congress.py: members and committees, and the edge-case roll calls."""
import runpy
import sys

sys.argv = ["audit_congress.py", "rerun"]
runpy.run_path("scripts/probe/audit_congress.py", run_name="__main__")
