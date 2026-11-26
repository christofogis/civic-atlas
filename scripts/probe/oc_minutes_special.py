"""Print the full text of recent Board of Supervisors special-meeting minutes (pdftotext -layout),
to see their layout before parsing them. Prints only."""
import json, subprocess, tempfile, urllib.request
d = json.load(open("public/data/local/ca-orange-agendas.json"))
for p in [p for p in d["previous"] if "Special" in p["title"] and p.get("minutes_url")][:3]:
    print("=" * 30, "MEETING", p["date"], p["time"], p["minutes_url"])
    try:
        raw = urllib.request.urlopen(urllib.request.Request(p["minutes_url"], headers={"User-Agent": "civic-atlas probe"}), timeout=60).read()
    except Exception as e:
        print("FETCH FAILED", e); continue
    print("BYTES", len(raw), raw[:8])
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f: f.write(raw)
    txt = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True).stdout
    print(txt[:20000])
