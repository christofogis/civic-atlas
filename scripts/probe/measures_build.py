"""Run the measures build on a runner (the Secretary of State's site refuses some networks) and print
its log and the file it writes, base64, so the result can be checked and committed. Writes nothing
to the repository."""
import base64
import subprocess

r = subprocess.run(["node", "--version"], capture_output=True, text=True)
print("node", r.stdout.strip())
r = subprocess.run(["node", "scripts/data/measures.mjs"], capture_output=True, text=True)
print(r.stdout)
print(r.stderr)
print("exit", r.returncode)
data = base64.b64encode(open("public/data/measures/ca-2028.json", "rb").read()).decode()
print("BEGIN64")
for i in range(0, len(data), 1000):
    print(data[i:i + 1000])
print("END64")
