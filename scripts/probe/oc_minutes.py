import json, subprocess, tempfile, urllib.request
d = json.load(open("public/data/local/ca-orange-agendas.json"))
p = d["previous"][0]
print("MEETING", p["date"], p["minutes_url"])
raw = urllib.request.urlopen(urllib.request.Request(p["minutes_url"], headers={"User-Agent": "civic-atlas probe"}), timeout=60).read()
print("BYTES", len(raw), raw[:8])
with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f: f.write(raw)
txt = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True).stdout
i = txt.find("CONSENT CALENDAR")
print("TEXT", txt[i:i + 7000])
