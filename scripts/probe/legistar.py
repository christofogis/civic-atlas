import json, urllib.request
cands = ["anaheim","santaana","santa-ana","irvine","huntingtonbeach","costamesa","newportbeach","fullerton","cityoforange","orange","gardengrove","westminster","fountainvalley","tustin","buenapark","lakeforest","yorbalinda","missionviejo","sanclemente","lagunaniguel","laguna-niguel","lagunahills","lagunabeach","lagunawoods","placentia","brea","cypress","stanton","laalma","lapalma","seal-beach","sealbeach","dana-point","danapoint","sanjuancapistrano","rancho-santa-margarita","ranchosantamargarita","aliso-viejo","alisoviejo","villapark","losalamitos","ocgov","orangecounty"]
for c in cands:
    try:
        with urllib.request.urlopen(urllib.request.Request(f"https://webapi.legistar.com/v1/{c}/bodies", headers={"User-Agent":"civic-atlas probe"}), timeout=20) as r:
            b = json.load(r); print("OK", c, len(b), [x.get("BodyName") for x in b][:4])
    except Exception as e:
        print("NO", c, str(e)[:40])
