import json, urllib.request
cands = ["cityofanaheim","anaheimca","anaheim-ca","santaanaca","santa-anaca","cityofsantaana","cityofirvine","irvineca","gardengroveca","ggcity","cityofgardengrove","tustinca","cityoftustin","cityofbrea","breaca","lagunabeachcity","cityoflagunabeach","cityofsanclemente","sanclementeca","cityofwestminster","westminsterca","buenaparkca","cityofbuenapark","cypressca","cityofcypress","placentiaca","cityofplacentia","yorbalindaca","cityofmissionviejo","lakeforestca","cityoflakeforest","danapointca","sealbeachca","cityofsealbeach","fountainvalleyca","stantonca","lapalmaca","lagunahillsca","lagunaniguelca","cityoflagunaniguel","sjcapistrano","sanjuancapistranoca","rsmca","cityofrsm","alisoviejoca","villaparkca","lagunawoodsca","cityoflosalamitos","losalamitosca"]
for c in cands:
    try:
        with urllib.request.urlopen(urllib.request.Request(f"https://webapi.legistar.com/v1/{c}/bodies", headers={"User-Agent":"civic-atlas probe"}), timeout=20) as r:
            b = json.load(r); print("OK", c, len(b), [x.get("BodyName") for x in b][:3])
    except Exception as e:
        pass
# Also: the next City Council meeting and its items for one known city, to see the fields.
def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":"civic-atlas probe"}), timeout=30) as r: return json.load(r)
ev = get("https://webapi.legistar.com/v1/newportbeach/events?$filter=EventDate+ge+datetime'2026-11-01'&$orderby=EventDate&$top=5")
for e in ev: print("EV", {k: e.get(k) for k in ["EventId","EventBodyName","EventDate","EventTime","EventLocation","EventAgendaFile","EventAgendaStatusName","EventInSiteURL"]})
if ev:
    items = get(f"https://webapi.legistar.com/v1/newportbeach/events/{ev[0]['EventId']}/eventitems?AgendaNote=1&Attachments=1")
    print("N", len(items))
    for it in items[:12]: print("IT", {k: (str(it.get(k))[:100] if it.get(k) is not None else None) for k in ["EventItemAgendaSequence","EventItemAgendaNumber","EventItemTitle","EventItemMatterFile","EventItemMatterType","EventItemActionName","EventItemConsent"]}, len(it.get("EventItemMatterAttachments") or []))
