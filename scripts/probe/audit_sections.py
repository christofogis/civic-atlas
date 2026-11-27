"""Accuracy audit of AI section summaries: print the official enrolled text of a sample of
summarized sections (found the same way lib/billtext.js finds them), to compare by hand with the
stored summary. Prints only."""
import re
import urllib.request
import xml.etree.ElementTree as ET

UA = {"User-Agent": "civic-atlas audit (github.com/christofogis/civic-atlas)"}
CONTAINERS = {"division", "title", "subtitle", "part", "subpart", "chapter", "subchapter"}
BODIES = {"legis-body", "resolution-body"}

SAMPLE = {
    "119hr5334": ["lindsey o. graham sanctioning russia and iran act of 2026 > other matters > severability"],
    "119hr1": [
        "committee on agriculture, nutrition, and forestry > additional investments in rural america > horticulture",
        "finance > tax > references to the internal revenue code of 1986, etc",
        "finance > tax > ending green new deal spending, promoting america-first energy, and other reforms > termination of green new deal subsidies > termination and restrictions on clean electricity investment credit",
        "finance > health > medicaid > reducing fraud and improving enrollment processes > revising home equity limit for determining eligibility for long-term care services under the medicaid program",
        "finance > tax > investing in american families, communities, and small businesses > permanent investments in small business and rural america > expansion of qualified small business stock gain exclusion",
        "committee on homeland security and governmental affairs > homeland security provisions > presidential residence protection",
        "finance > health > medicaid > reducing fraud and improving enrollment processes > moratorium on implementation of rule relating to eligibility and enrollment in medicare savings programs",
        "committee on health, education, labor, and pensions > accountability > ineligibility based on low earning outcomes",
        "finance > health > medicaid > reducing fraud and improving enrollment processes > eligibility redeterminations",
        "finance > tax > investing in american families, communities, and small businesses > permanent investments in small business and rural america > extension of rules for treatment of certain disaster-related personal casualty losses",
        "finance > tax > investing in american families, communities, and small businesses > permanent investments in community development > adjustment of charitable deduction for certain expenses incurred in support of native alaskan subsistence whaling",
    ],
    "119s2": ["committee on homeland security and governmental affairs > u.s. customs and border protection personnel"],
    "119hr6500": ["continuing appropriations act, 2027 > (untitled section) #51"],
    "119hr6644": ["oversight and accountability > appraisal modernization act"],
}
URLS = {b: f"https://www.govinfo.gov/content/pkg/BILLS-{b}enr/xml/BILLS-{b}enr.xml" for b in SAMPLE}


def norm(s):
    s = re.sub(r"[‘’`]", "'", s); s = re.sub(r"[“”]", '"', s); s = re.sub(r"[–—]", "-", s)
    s = re.sub(r"\s+", " ", s); s = re.sub(r"\s([,.;:)])", r"\1", s); s = re.sub(r"\(\s", "(", s)
    return s.strip()


def deleted(n):
    return n.tag == "deleted-phrase" or n.get("changed") == "deleted"


def text_of(n, skip=None):
    if deleted(n) or (skip is not None and n is skip):
        return ""
    parts = [n.text or ""]
    for c in n:
        if deleted(c) or c is skip:
            parts.append(" " + (c.tail or ""))
            continue
        parts.append(" " + text_of(c, skip) + " " + (c.tail or ""))
    return " ".join(parts)


def sections(root):
    bodies = [b for b in root.iter() if b.tag in BODIES]
    out, seen = [], {}

    def walk(n, path):
        for c in n:
            if deleted(c) or c.tag == "quoted-block":
                continue
            if c.tag in CONTAINERS:
                h = c.find("header")
                h = norm(text_of(h)) if h is not None else ""
                walk(c, path + [h] if h else path)
            elif c.tag == "section":
                h = c.find("header")
                header = (norm(text_of(h)) if h is not None else "") or "(untitled section)"
                text = norm(text_of(c, c.find("enum")))
                key = " > ".join(path + [header]).lower()
                seen[key] = seen.get(key, 0) + 1
                if seen[key] > 1:
                    key += f" #{seen[key]}"
                out.append((key, text))
            else:
                walk(c, path)
    for b in bodies:
        walk(b, [])
    return out


for b, keys in SAMPLE.items():
    req = urllib.request.Request(URLS[b], headers=UA)
    root = ET.fromstring(urllib.request.urlopen(req, timeout=120).read())
    secs = dict(sections(root))
    print(f"===== {b} ({len(secs)} sections) {URLS[b]}")
    for k in keys:
        t = secs.get(k)
        print(f"\n--- {k}\n{(t[:7000] + ' [...]') if t and len(t) > 7000 else t}")
