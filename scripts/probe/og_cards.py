"""Trial run of the deploy-time link-preview cards (scripts/og/build.mjs) on a GitHub runner:
how long all ~10,000 cards take, their sizes, and the build's total file count against Cloudflare
Pages' 20,000-file limit. Prints only; writes nothing outside the runner."""
import json, os, subprocess, time

def run(cmd, env=None):
    t = time.time()
    p = subprocess.run(cmd, shell=True, capture_output=True, text=True, env={**os.environ, **(env or {})})
    print(f"$ {cmd}  ({time.time() - t:.0f} s, exit {p.returncode})")
    print("\n".join((p.stdout + p.stderr).strip().splitlines()[-25:]))
    return p.returncode

print("cpus:", os.cpu_count())
run("node -v")
run("npm ci --no-audit --no-fund")
run("npx vite build")
run("node scripts/og/build.mjs", {"OG_CARDS": "1"})
files = sizes = 0
per = {}
for root, _, names in os.walk("dist"):
    for n in names:
        files += 1
        s = os.path.getsize(os.path.join(root, n))
        sizes += s
        if root.startswith("dist/og/"):
            k = root.split("/")[2]
            c, t, m = per.get(k, (0, 0, 0))
            per[k] = (c + 1, t + s, max(m, s))
print(f"dist: {files} files, {sizes / 1e6:.0f} MB")
for k, (c, t, m) in sorted(per.items()):
    print(f"  og/{k}: {c} cards, avg {t / c / 1e3:.0f} KB, max {m / 1e3:.0f} KB")
for p in ["og/member/P000145.png", "og/member/G000578.png", "og/bill/119-hr-1.png", "og/bill/119-hr-504.png", "og/committee/HSAG.png", "og/ballot/2028.png"]:
    f = f"dist/{p}"
    print(p, os.path.getsize(f) if os.path.exists(f) else "missing")
if os.path.exists("dist/og/cards.json"):
    print(open("dist/og/cards.json").read())
