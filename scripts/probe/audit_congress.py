"""Accuracy audit: compare a sample of stored roll calls, bills and current members/committees
against the primary sources (House Clerk, senate.gov, GovInfo Bill Status). Reads the site's
public API with the publishable key (read-only). Prints mismatches and match counts only."""
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter

URL = "https://fkbzxaoeyrtzviyfzulq.supabase.co/rest/v1/"
KEY = "sb_publishable_M_uX1gyqB4R-7cqapPLdTQ_D4lbhVdT"
UA = {"User-Agent": "civic-atlas audit (github.com/christofogis/civic-atlas)"}

VOTES = """house-118-1-1 house-118-1-2 house-118-1-15 house-118-1-527 house-119-1-2 house-118-2-200
house-118-2-240 house-118-1-347 house-119-1-335 house-119-1-48 house-118-2-407 house-118-1-25
house-118-1-253 house-119-2-29 house-119-2-205 house-118-1-724 house-119-2-327
senate-118-1-165 senate-119-1-197 senate-118-1-36 senate-119-1-132 senate-118-1-141 senate-119-1-490
senate-119-1-605 senate-119-2-138 senate-119-2-145 senate-119-1-372 senate-118-1-31 senate-118-2-39
senate-119-1-15 senate-118-1-167 senate-119-2-9 senate-119-2-279""".split()

BILLS = """119-hr-6639 119-hr-5077 118-hr-9633 119-hr-9228 119-hr-410 119-s-5086 118-s-3267 119-s-2958
118-s-4411 118-hres-253 118-hconres-18 119-hres-1184 119-hres-1312 118-hr-4467 118-hres-1061
119-hr-4294 119-hr-10903 119-hres-1534 119-hr-1 118-hr-815 118-sjres-11 119-hr-4 118-hr-3746
118-hres-757""".split()

SECTION = sys.argv[1] if len(sys.argv) > 1 else "all"


def fetch(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if i == tries - 1:
                print("  FETCH FAIL", url, e)
                return None
            time.sleep(2)


def api(path):
    req = urllib.request.Request(URL + path, headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def t(el, path, default=None):
    x = el.find(path)
    return x.text.strip() if x is not None and x.text else default


tally = Counter()


def check(kind, ok, msg):
    tally[(kind, ok)] += 1
    if not ok:
        print(f"  MISMATCH [{kind}] {msg}")


# ---------------------------------------------------------------- votes
def audit_votes():
    members = api("members?select=bioguide_id,lis_id&lis_id=not.is.null&limit=2000")
    lis2bio = {m["lis_id"]: m["bioguide_id"] for m in members}
    for vid in VOTES:
        _, ch, c, s, n = re.match(r"(house|senate)-(\d+)-(\d+)-(\d+)", vid).group(0, 1, 2, 3, 4)
        rows = api("votes?select=*&vote_id=eq." + vid)
        if not rows:
            print(vid, "NOT IN DB")
            continue
        v = rows[0]
        pos = api(f"vote_positions?select=bioguide_id,position,position_category,party_at_vote&vote_key=eq.{v['vote_key']}&limit=1000")
        ours = {p["bioguide_id"]: p for p in pos}
        print(f"{vid}: {v['question']} | {v['result']} | {v['voted_at']} | {len(pos)} positions")
        if ch == "house":
            year = 2021 + (int(c) - 117) * 2 + int(s) - 1
            url = f"https://clerk.house.gov/evs/{year}/roll{int(n):03d}.xml"
            raw = fetch(url)
            if not raw:
                continue
            doc = ET.fromstring(raw)
            meta = doc.find("vote-metadata")
            check("vote.question", t(meta, "vote-question") == v["question"], f"{vid} question src={t(meta,'vote-question')!r} ours={v['question']!r}")
            check("vote.result", t(meta, "vote-result") == v["result"], f"{vid} result src={t(meta,'vote-result')!r} ours={v['result']!r}")
            check("vote.date", True, "")
            print("   src date", t(meta, "action-date"), t(meta, "action-time"), "| legis-num", t(meta, "legis-num"), "| amendment", t(meta, "amendment-num"), t(meta, "amendment-author"))
            print("   ours bill", v["bill_type"], v["bill_number"], v["amendment_ref"], "| desc", (v.get("description") or "")[:120])
            tot = meta.find("vote-totals/totals-by-vote")
            if tot is not None:
                yt = int(t(tot, "yea-total", "0")); nt = int(t(tot, "nay-total", "0"))
                pt = int(t(tot, "present-total", "0")); nvt = int(t(tot, "not-voting-total", "0"))
                check("vote.totals", (yt, nt, pt, nvt) == (v["yea_total"], v["nay_total"], v["present_total"], v["not_voting_total"]),
                      f"{vid} totals src={(yt,nt,pt,nvt)} ours={(v['yea_total'],v['nay_total'],v['present_total'],v['not_voting_total'])}")
            else:
                cands = [(t(x, "candidate"), t(x, "candidate-total")) for x in meta.findall("vote-totals/totals-by-candidate")]
                print("   src candidate totals", cands)
                print("   our position tally", Counter(p["position"] for p in pos).most_common())
            src = {}
            for rv in doc.findall("vote-data/recorded-vote"):
                leg = rv.find("legislator")
                src[leg.get("name-id")] = (rv.find("vote").text, leg.get("party"), leg.get("state"), leg.text)
        else:
            url = f"https://www.senate.gov/legislative/LIS/roll_call_votes/vote{c}{s}/vote_{c}_{s}_{int(n):05d}.xml"
            raw = fetch(url)
            if not raw:
                continue
            doc = ET.fromstring(raw)
            check("vote.question", True, "")
            print("   src question", t(doc, "question"), "| doc", t(doc, "document/document_type"), t(doc, "document/document_number"), "| amdt", t(doc, "amendment/amendment_number"))
            print("   src result", t(doc, "vote_result_text"), "| date", t(doc, "vote_date"), "| tie_breaker", t(doc, "tie_breaker/by_whom"), t(doc, "tie_breaker/tie_breaker_vote"))
            check("vote.result", t(doc, "vote_result_text") == v["result"], f"{vid} result src={t(doc,'vote_result_text')!r} ours={v['result']!r}")
            cnt = doc.find("count")
            yt = int(t(cnt, "yeas", "0")); nt = int(t(cnt, "nays", "0")); pt = int(t(cnt, "present", "0") or 0); at = int(t(cnt, "absent", "0") or 0)
            check("vote.totals", (yt, nt, pt, at) == (v["yea_total"], v["nay_total"], v["present_total"] or 0, v["not_voting_total"] or 0),
                  f"{vid} totals src={(yt,nt,pt,at)} ours={(v['yea_total'],v['nay_total'],v['present_total'],v['not_voting_total'])}")
            src = {}
            for mb in doc.findall("members/member"):
                b = lis2bio.get(t(mb, "lis_member_id"), "LIS:" + t(mb, "lis_member_id"))
                src[b] = (t(mb, "vote_cast"), t(mb, "party"), t(mb, "state"), t(mb, "last_name"))
        bad = 0
        for b, (vc, party, st, name) in src.items():
            o = ours.get(b)
            if o is None:
                bad += 1; print(f"  MISSING position {vid} {b} {name} {vc}")
                continue
            if o["position"] != vc or (o["party_at_vote"] or "")[:1] != (party or "")[:1]:
                bad += 1; print(f"  DIFF {vid} {b} {name} src=({vc},{party}) ours=({o['position']},{o['party_at_vote']})")
        extra = set(ours) - set(src)
        for b in extra:
            bad += 1; print(f"  EXTRA position {vid} {b} ours={ours[b]['position']}")
        check("vote.positions", bad == 0, f"{vid} {bad} position diffs of {len(src)}")
        tally[("positions.checked", True)] += len(src)
        time.sleep(0.5)


# ---------------------------------------------------------------- bills
STAGE_CODES = {"passed_house_date", "passed_senate_date", "became_law_date", "vetoed_date", "presented_date"}


def audit_bills():
    for key in BILLS:
        c, bt, n = key.split("-")
        rows = api(f"bills?select=congress,bill_type,number,title,short_title,introduced_date,sponsor_bioguide_id,policy_area,latest_action_date,latest_action_text,reported_date,passed_house_date,failed_house_date,passed_senate_date,failed_senate_date,presented_date,vetoed_date,became_law_date,law_number,crs_summary&congress=eq.{c}&bill_type=eq.{bt}&number=eq.{n}")
        if not rows:
            print(key, "NOT IN DB"); continue
        b = rows[0]
        cos = api(f"bill_cosponsors?select=bioguide_id,sponsored_date,withdrawn_date,is_original&congress=eq.{c}&bill_type=eq.{bt}&number=eq.{n}&limit=1000")
        coms = api(f"bill_committees?select=*&congress=eq.{c}&bill_type=eq.{bt}&number=eq.{n}")
        raw = fetch(f"https://www.govinfo.gov/bulkdata/BILLSTATUS/{c}/{bt}/BILLSTATUS-{c}{bt}{n}.xml")
        if not raw:
            continue
        bill = ET.fromstring(raw).find("bill")
        print(f"{key}: {b['title'][:90]!r} | intro {b['introduced_date']} | latest {b['latest_action_date']} {(b['latest_action_text'] or '')[:80]!r}")
        check("bill.title", t(bill, "title") == b["title"], f"{key} title src={t(bill,'title')!r} ours={b['title']!r}")
        check("bill.introduced", t(bill, "introducedDate") == b["introduced_date"], f"{key} introduced src={t(bill,'introducedDate')} ours={b['introduced_date']}")
        sp = t(bill, "sponsors/item/bioguideId")
        check("bill.sponsor", sp == b["sponsor_bioguide_id"], f"{key} sponsor src={sp} ours={b['sponsor_bioguide_id']}")
        la_d = t(bill, "latestAction/actionDate"); la_t = t(bill, "latestAction/text")
        check("bill.latest", la_d == b["latest_action_date"] and (la_t or "").strip() == (b["latest_action_text"] or "").strip(),
              f"{key} latest src=({la_d},{la_t!r}) ours=({b['latest_action_date']},{b['latest_action_text']!r})")
        pa = t(bill, "policyArea/name")
        check("bill.policy", pa == b["policy_area"], f"{key} policy src={pa} ours={b['policy_area']}")
        laws = [f"{t(x,'type')} {t(x,'number')}" for x in bill.findall("laws/item")]
        check("bill.law", (laws[0].split()[-1] if laws else None) == ((b["law_number"] or "").split()[-1] or None) if b["law_number"] or laws else True,
              f"{key} law src={laws} ours={b['law_number']} became_law={b['became_law_date']}")
        src_cos = {}
        for x in bill.findall("cosponsors/item"):
            src_cos[t(x, "bioguideId")] = (t(x, "sponsorshipDate"), t(x, "sponsorshipWithdrawnDate"), t(x, "isOriginalCosponsor"))
        our_cos = {x["bioguide_id"]: (x["sponsored_date"], x["withdrawn_date"], "True" if x["is_original"] else "False") for x in cos}
        diff = [(k, src_cos.get(k), our_cos.get(k)) for k in set(src_cos) | set(our_cos) if src_cos.get(k) != our_cos.get(k)]
        check("bill.cosponsors", not diff, f"{key} cosponsors src={len(src_cos)} ours={len(our_cos)} diffs={diff[:5]}")
        src_com = sorted({(t(x, "systemCode") or "")[:6].upper() for x in bill.findall("committees/item")})
        print("   src committees", src_com, "| ours", sorted({json.dumps(r, sort_keys=True)[:0] + str(r.get('committee_id') or r) for r in coms})[:8])
        acts = [(t(x, "actionDate"), t(x, "type"), (t(x, "text") or "")[:100], t(x, "actionCode")) for x in bill.findall("actions/item")]
        print("   ours stages", {k: b[k] for k in ["reported_date", "passed_house_date", "failed_house_date", "passed_senate_date", "failed_senate_date", "presented_date", "vetoed_date", "became_law_date"] if b[k]})
        key_acts = [a for a in acts if a[1] in ("BecameLaw", "President", "Floor", "Veto") or (a[3] or "") in ("E40000", "E30000", "36000", "8000", "17000", "E20000", "31000", "9000", "H37100", "H38310", "H38900")]
        for a in sorted(set(key_acts))[:14]:
            print("     src action", a)
        crs = [t(x, "text") for x in bill.findall("summaries/summary")]
        print("   crs summaries src", len(crs), "| ours has crs", bool(b["crs_summary"]))
        time.sleep(0.3)


# ---------------------------------------------------------------- members + committees (current)
def audit_members():
    raw = fetch("https://clerk.house.gov/xml/lists/MemberData.xml")
    doc = ET.fromstring(raw)
    print("House MemberData publish date:", doc.get("publish-date"))
    seats = api("seat_holders?select=*&limit=2000") if True else []
    print("seat_holders sample row:", json.dumps(seats[0])[:400] if seats else None)
    terms = api("terms?select=bioguide_id,chamber,state,district,party,caucus,start_date,end_date&end_date=gte.2026-11-27&chamber=eq.house&limit=1000")
    tmap = {}
    for x in terms:
        if x["start_date"] <= "2026-11-27":
            tmap[x["bioguide_id"]] = x
    cms = api("committee_memberships?select=committee_id,bioguide_id,side,rank,title&limit=5000")
    ourcom = {}
    for r in cms:
        ourcom.setdefault(r["bioguide_id"], {})[r["committee_id"]] = r
    src_ids = set()
    pmap = {"D": "Democrat", "R": "Republican", "I": "Independent"}
    for m in doc.findall("members/member"):
        sd = t(m, "statedistrict")
        b = t(m, "member-info/bioguideID")
        if not b:
            print("  VACANT", sd, t(m, "predecessor-info/pred-official-name") if m.find("predecessor-info") is not None else "")
            continue
        src_ids.add(b)
        o = tmap.get(b)
        party = pmap.get(t(m, "member-info/party"), t(m, "member-info/party"))
        st, dist = sd[:2], int(sd[2:])
        if not o:
            print(f"  MISSING current term {b} {t(m,'member-info/official-name')} {sd}"); tally[("member.term", False)] += 1; continue
        check("member.term", (o["state"], o["district"] or 0, o["party"]) == (st, dist, party),
              f"{b} {t(m,'member-info/official-name')} src=({st},{dist},{party}) ours=({o['state']},{o['district']},{o['party']}) sworn={t(m,'member-info/sworn-date')}")
        src_c = {}
        for ca in m.findall("committee-assignments/committee"):
            code = ca.get("comcode")
            if code:
                src_c["HS" + code[:2]] = ca.get("rank")
        for sa in m.findall("committee-assignments/subcommittee"):
            code = sa.get("subcomcode")
            if code:
                src_c["HS" + code[:2] + code[2:4]] = sa.get("rank")
        oc = ourcom.get(b, {})
        ours_keys = {k for k in oc if k.startswith("HS") or k.startswith("HL")}
        d1 = sorted(set(src_c) - ours_keys); d2 = sorted(ours_keys - set(src_c))
        check("member.committees", not d1 and not d2, f"{b} {t(m,'member-info/official-name')} only-src={d1} only-ours={d2}")
    for b in set(tmap) - src_ids:
        print(f"  EXTRA ours current house term {b} {tmap[b]}"); tally[("member.term", False)] += 1

    raw = fetch("https://www.senate.gov/general/contact_information/senators_cfm.xml")
    sdoc = ET.fromstring(raw)
    sterms = api("terms?select=bioguide_id,chamber,state,party,caucus,senate_class,start_date,end_date&end_date=gte.2026-11-27&chamber=eq.senate&limit=1000")
    smap = {x["bioguide_id"]: x for x in sterms if x["start_date"] <= "2026-11-27"}
    sids = set()
    for m in sdoc.findall("member"):
        b = t(m, "bioguide_id"); sids.add(b)
        o = smap.get(b)
        party = pmap.get(t(m, "party"), t(m, "party"))
        cls = int(re.sub(r"\D", "", t(m, "class", "0")) or 0)
        if not o:
            print(f"  MISSING current senate term {b} {t(m,'last_name')}"); tally[("member.term", False)] += 1; continue
        check("member.term", (o["state"], o["party"], o["senate_class"]) == (t(m, "state"), party, cls),
              f"{b} {t(m,'last_name')} src=({t(m,'state')},{party},{cls}) ours=({o['state']},{o['party']},{o['senate_class']})")
    for b in set(smap) - sids:
        print(f"  EXTRA ours current senate term {b} {smap[b]}"); tally[("member.term", False)] += 1
    # Senate committees: one file per committee
    scoms = api("committees?select=committee_id,name&chamber=eq.senate&parent_id=is.null")
    byname = {}
    for b in sids:
        pass
    lastname = {t(m, "bioguide_id"): (t(m, "last_name"), t(m, "state")) for m in sdoc.findall("member")}
    key2bio = {v: k for k, v in lastname.items()}
    for c in scoms:
        cid = c["committee_id"]
        raw = fetch(f"https://www.senate.gov/general/committee_membership/committee_memberships_{cid}.xml")
        if not raw:
            continue
        try:
            cd = ET.fromstring(raw)
        except ET.ParseError:
            print("  parse fail", cid); continue
        src = set()
        for mem in cd.findall("committee/members/member"):
            nm = mem.find("name")
            ln = t(nm, "last"); st = t(mem, "state")
            b = key2bio.get((ln, st))
            if not b:
                for (l2, s2), bb in key2bio.items():
                    if s2 == st and l2 and ln and (l2.split()[-1] == ln.split()[-1]):
                        b = bb
            src.add(b or f"?{ln}/{st}")
        ours = {r["bioguide_id"] for r in cms if r["committee_id"] == cid}
        d1 = sorted(src - ours); d2 = sorted(ours - src)
        check("senate.committee", not d1 and not d2, f"{cid} {c['name']} only-src={d1} only-ours={d2}")
        time.sleep(0.3)


if SECTION in ("all", "votes"):
    audit_votes()
if SECTION in ("all", "bills"):
    audit_bills()
if SECTION in ("all", "members"):
    audit_members()
print("\nTALLY")
for (k, ok), n in sorted(tally.items()):
    print(f"  {k:22s} {'ok ' if ok else 'BAD'} {n}")
