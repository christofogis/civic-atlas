"""Check the official links on the First time voting page respond, including vote.gov's page for
each state. Prints status codes only; writes nothing."""
import re
import urllib.request

STATES = ["alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
          "district-of-columbia", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas",
          "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
          "missouri", "montana", "nebraska", "nevada", "new-hampshire", "new-jersey", "new-mexico", "new-york",
          "north-carolina", "north-dakota", "ohio", "oklahoma", "oregon", "pennsylvania", "rhode-island",
          "south-carolina", "south-dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington",
          "west-virginia", "wisconsin", "wyoming"]

FIXED = ["https://vote.gov/", "https://vote.gov/es/", "https://registertovote.ca.gov/", "https://registertovote.ca.gov/es",
         "https://voterstatus.sos.ca.gov/", "https://www.sos.ca.gov/elections/pre-register-16-vote-18",
         "https://www.archives.gov/founding-docs/amendments-11-27"]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (link check)"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            body = r.read(400000).decode("utf-8", "replace")
            return r.status, r.geturl(), body
    except urllib.error.HTTPError as e:
        return e.code, url, ""
    except Exception as e:  # noqa: BLE001
        return f"ERR {type(e).__name__}: {e}", url, ""


def title(body):
    m = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
    return re.sub(r"\s+", " ", m.group(1)).strip()[:90] if m else ""


for u in FIXED:
    s, final, body = get(u)
    print(s, u, "->", final, "|", title(body))
    if u == "https://vote.gov/":
        for k in ["pre-register", "preregister", "16", "17"]:
            i = body.lower().find(k)
            if k.startswith("pre") and i >= 0:
                print("   vote.gov mentions:", re.sub(r"<[^>]+>|\s+", " ", body[max(0, i - 150): i + 150]))

for st in STATES:
    for base in ["https://vote.gov/register/", "https://vote.gov/es/register/"]:
        s, final, body = get(base + st)
        print(s, base + st, "->", final, "|", title(body))
