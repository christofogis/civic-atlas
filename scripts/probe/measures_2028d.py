"""SB 895's last page (the Governor's approval and the Secretary of State's filing stamp) as a small
grayscale PNG, base64 in the log, to read the dates the OCR text garbles. Prints only."""
import base64
import subprocess
import urllib.request

req = urllib.request.Request("https://elections.cdn.sos.ca.gov/ballot-measures/pdf/sb895-ch1040.pdf",
                             headers={"User-Agent": "civic-atlas measures build (github.com/christofogis/civic-atlas)"})
open("/tmp/m.pdf", "wb").write(urllib.request.urlopen(req, timeout=40).read())
subprocess.run(["pdftoppm", "-f", "28", "-l", "28", "-r", "90", "-gray", "-png", "/tmp/m.pdf", "/tmp/last"], check=True)
import glob
png = sorted(glob.glob("/tmp/last*.png"))[0]
data = base64.b64encode(open(png, "rb").read()).decode()
print("BEGIN64")
for i in range(0, len(data), 1000):
    print(data[i:i + 1000])
print("END64")
