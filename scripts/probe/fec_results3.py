"""Print the source files for election results as base64 (between BEGIN/END markers) so the parser
can be developed and tested offline: FEC Federal Elections 2022 workbook, FEC 2024 congressional
general-election ballot list, House Clerk 2024 and 2022 Statistics of the Congressional Election."""
import base64, urllib.request
UA = {"User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)"}
for name, url in [
    ("fe2022.xlsx", "https://www.fec.gov/documents/5676/federalelections2022.xlsx"),
    ("ge2024cands.xlsx", "https://www.fec.gov/documents/5548/2024congressgecands.xlsx"),
    ("clerk2024.pdf", "https://clerk.house.gov/member_info/electionInfo/2024/statistics2024.pdf"),
    ("clerk2022.pdf", "https://clerk.house.gov/member_info/electionInfo/2022/statistics2022.pdf"),
]:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        b = r.read()
    print("BEGIN", name, len(b))
    s = base64.b64encode(b).decode()
    for i in range(0, len(s), 76): print(s[i:i + 76])
    print("END", name)
