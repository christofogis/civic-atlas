# Orange County city council agendas: how each city publishes them

Survey of all 34 cities, Nov 25–26, 2026, run from GitHub Actions with the probe workflow
(`scripts/probe/oc_cities.py` through `oc_cities5.py`, `oc_verify.py`). One request per city
website page, short pauses between requests. Sites that refused automated requests were not
retried or worked around.

"API" below means a vendor endpoint that returns structured data (JSON or OData) without a login,
key or CAPTCHA. "Feed" means RSS. Everything else is a web page or PDFs.

## Summary

| System | Cities | Read by Civic Atlas |
|---|---|---|
| Legistar (public web API) | 7: Costa Mesa, Fullerton, Huntington Beach, Newport Beach, Orange, San Clemente, Westminster | Yes, all 7 (`scripts/data/city_agendas.py`) |
| CivicClerk (public OData API) | 4: Fountain Valley, La Palma, Laguna Hills, Los Alamitos | Not yet (API works; see below) |
| PrimeGov (public JSON API) | 4: Laguna Beach, Lake Forest, Santa Ana, Seal Beach | Not yet (API works; see below) |
| Granicus (agenda viewer + RSS) | 4: Aliso Viejo, Irvine, Mission Viejo (also OnBase Agenda Online), Tustin | No: RSS lists meetings and agenda links only, no items |
| eSCRIBE | 1: Yorba Linda | No: only the calendar endpoint its own page calls |
| CivicPlus Agenda Center (RSS) | 2: La Habra, Laguna Niguel | No: RSS lists posted agenda files only |
| Laserfiche public portal | 2: Brea, Placentia | No |
| AgendaLink | 1: Buena Park | No |
| AgendaSuite | 1: Garden Grove | No |
| PDFs on the city website | 3: Dana Point, Stanton, Villa Park | No |
| Not identified | 5: Anaheim, Cypress, Laguna Woods, Rancho Santa Margarita, San Juan Capistrano | No |

Headline: 15 of 34 cities publish through a clean public API (Legistar 7, CivicClerk 4,
PrimeGov 4). The 7 Legistar cities are read now; CivicClerk and PrimeGov would add 8 more,
including Los Alamitos and Santa Ana.

## All 34 cities

| City | System | Client id / URL | API | Notes |
|---|---|---|---|---|
| Aliso Viejo | Granicus | `alisoviejoca.granicus.com/ViewPublisher.php?view_id=1` (and `view_id=3`) | No (RSS) | Linked from avcity.org/129/Agendas-Minutes. Agenda Center RSS is empty. |
| Anaheim | Not identified | anaheim.net | — | Website answers 403 to automated requests. A CivicClerk tenant `anaheimca` exists but holds only test events (latest Apr 2026), so it is not the council's live system. |
| Brea | Laserfiche | `portal.laserfiche.com` repo `r-7237a073` | No | Linked from cityofbrea.gov/1857/Meetings-and-Agendas. |
| Buena Park | AgendaLink | `horizon.agendalink.app/engage-v2/buenaparkca/agendas` | Unknown | Not probed further. |
| Costa Mesa | Legistar | `costamesa` | Yes | Read. Council body: "REGULAR CITY COUNCIL AND HOUSING AUTHORITY*". |
| Cypress | Not identified | cypressca.org | — | Website answers 403 to automated requests; left alone. No Legistar, CivicClerk or PrimeGov account under likely names. |
| Dana Point | PDFs on city site | danapoint.org/City-Government/City-Council/Meetings-Agendas-Minutes | No | Granicus OpenCities website; agenda PDFs under /files/assets/; older records in Laserfiche (`r-0ead2617`). |
| Fountain Valley | CivicClerk | `fountainvalleyca` | Yes | Also posts to its CivicPlus Agenda Center (RSS has council agendas). |
| Fullerton | Legistar | `fullerton` | Yes | Read. |
| Garden Grove | AgendaSuite | `agendasuite.org/iip/gardengrove` | Unknown | ggcity.org/city-council/agenda-video redirects there. |
| Huntington Beach | Legistar | `huntingtonbeach` | Yes | Read. |
| Irvine | Granicus | `irvine.granicus.com/ViewPublisher.php?view_id=68` | No (RSS) | RSS `ViewPublisherRSS.php?view_id=68&mode=agendas` lists council meetings with AgendaViewer links. |
| La Habra | CivicPlus Agenda Center | lahabraca.gov/AgendaCenter | No (RSS) | RSS `RSSFeed.aspx?ModID=65&CID=All-0` answers. |
| La Palma | CivicClerk | `lapalmaca` | Yes | Next council meeting Dec 8, 2026 listed. |
| Laguna Beach | PrimeGov | `lagunabeachcity` | Yes | City website answers 403; the PrimeGov API is a separate public service and answered normally. |
| Laguna Hills | CivicClerk | `lagunahillsca` | Yes | Portal `lagunahillsca.portal.civicclerk.com` linked from the city site. Item-level sample below. |
| Laguna Niguel | CivicPlus Agenda Center | cityoflagunaniguel.org/AgendaCenter | No (RSS) | RSS lists "Agenda and Staff Reports for Regular City Council Meeting…" with file links. |
| Laguna Woods | Not identified | lagunawoods.gov/current-agendas/ | — | WordPress site; no vendor link found on the agenda pages. |
| Lake Forest | PrimeGov | `lakeforest` | Yes | Older records in Laserfiche (`r-d45ef59a`). |
| Los Alamitos | CivicClerk | `losalamitosca` | Yes | City website refuses automated requests and was not requested. CivicClerk's API (`losalamitosca.api.civicclerk.com`) is a separate public service and answered normally: council meeting Dec 14, 2026, commissions through Feb 2027. |
| Mission Viejo | Granicus + OnBase Agenda Online | `missionviejo.granicus.com` view 25; `dms.missionviejo.gov/OnBaseAgendaOnline/` | No (RSS) | Agenda and packet PDFs on OnBase; Granicus RSS lists meetings. |
| Newport Beach | Legistar | `newportbeach` | Yes | Read. |
| Orange | Legistar | `cityoforange` | Yes | Read. |
| Placentia | Laserfiche | `portal.laserfiche.com` repo `r-d37070b7` | No | Linked from placentia.org/667/Meetings-and-Agendas. Agenda Center RSS is empty. |
| Rancho Santa Margarita | Not identified | cityofrsm.org/129/Agendas-Minutes | — | CivicPlus site; no vendor link in the page; Agenda Center RSS is empty. |
| San Clemente | Legistar | `san-clemente` | Yes | Added Nov 26, 2026. Also posts to its CivicPlus Agenda Center. No council meeting posted yet past Nov 10 at the time of the survey; the Nov 10 agenda had 36 items with file numbers or attachments. |
| San Juan Capistrano | Not identified | sanjuancapistrano.gov (old .org redirects) | — | No vendor link on the home page; agenda page not yet found. |
| Santa Ana | PrimeGov | `santa-ana` | Yes | Older records in Laserfiche WebLink (cc-publicdocs.santa-ana.org). |
| Seal Beach | PrimeGov | `sealbeach` | Yes | |
| Stanton | PDFs on city site | stantonca.gov/government/agendas___minutes/city_council.php | No | Revize site; one PDF per agenda ("CC AGD 11-24-2026 …pdf"). |
| Tustin | Granicus | `tustin.granicus.com/ViewPublisher.php?view_id=5` | No (RSS likely) | Linked from tustinca.org/282/Meetings-Agendas. Agenda Center RSS is empty. |
| Villa Park | PDFs on city site | villapark.org/Council-and-Committees/Council-Agenda-and-Minutes | No | DNN site. |
| Westminster | Legistar | `westminsterca` | Yes | Read. |
| Yorba Linda | eSCRIBE | `pub-yorbalinda.escribemeetings.com` | Partly | The page's own calendar call (`POST /MeetingsCalendarView.aspx/GetCalendarMeetings`) returns JSON meetings with document links, but it is not a published API. |

## CivicClerk (4 cities)

OData service at `https://{tenant}.api.civicclerk.com/v1/`, no key. Tenants: `fountainvalleyca`,
`lapalmaca`, `lagunahillsca`, `losalamitosca`.

Upcoming meetings:

```
GET https://lagunahillsca.api.civicclerk.com/v1/Events?$filter=startDateTime ge 2026-11-20T00:00:00Z&$orderby=startDateTime&$top=6
```

```json
{"@odata.context":"https://lagunahillsca.api.civicclerk.com/v1/$metadata#Events",
 "value":[{"id":862,"eventName":"Parks and Recreation Commission Meeting",
  "startDateTime":"2026-12-02T18:00:00Z","agendaId":843,
  "categoryName":"Parks and Recreation Commission",
  "publishedFiles":[{"type":"Agenda","name":"P&R Commission Meeting Agenda - 12.2.26"},
                    {"type":"Agenda Packet","name":"P&R Commission Meeting Agenda Packet - 12.2.26"}]},
  {"id":844,"eventName":"City Council / Planning Agency Regular Meeting",
  "startDateTime":"2026-12-08T18:00:00Z","agendaId":836,
  "categoryName":"City Council / Planning Agency","publishedFiles":[]}, …]}
```

(Abridged.) Events also carry `eventLocation` (e.g. "City Council Chamber, 24035 El Toro Road").
`publishedFiles` stays empty until the city publishes the agenda; `agendaId` can be 0 for events
without one. Cancelled meetings say so in `eventName`.

Agenda items, once published:

```
GET https://lagunahillsca.api.civicclerk.com/v1/Meetings/835
```

Returns `agendaIsPublish`, `publishedFiles` and `items`: a tree of sections (`agendaObjectItemOutlineNumber`
"1.", `agendaObjectItemName` "Presentations and Proclamations") with `childItems` carrying the real
items (`agendaObjectItemNumber` "2026-1192", name "Laguna Hills High School Student Liaison
Report", `attachmentsList`, `reportsList`). Item names can contain HTML (`<span style=…>`), so
they need tags stripped. The same filter as Legistar applies naturally: keep items with an item
number or attachments; top-level entries without them are headings or procedure.

## PrimeGov (4 cities)

JSON at `https://{tenant}.primegov.com/api/v2/PublicPortal/ListUpcomingMeetings`, no key.
Tenants: `lagunabeachcity`, `lakeforest`, `santa-ana`, `sealbeach`.

```json
[{"id":2630,"meetingTypeId":1,"committeeId":1,"title":"City Council - Regular Meeting",
  "dateTime":"2026-12-01T18:30:00","date":"Dec 01, 2026","time":"06:30 PM",
  "documentList":[{"id":16779,"compileOutputType":3,"publishStatus":1,
    "publishDate":"2026-11-25T23:28:50.417","templateId":12225,"meetingId":2630,
    "templateName":"HTML Full Agenda Packet"}, …],
  "location":…, "videoUrl":null, …}]
```

(Abridged, Lake Forest.) Each meeting lists its published documents (Agenda, Full Agenda Packet as
PDF `compileOutputType` 1, HTML packet as 3). Item-level data would come from the HTML agenda;
not probed tonight. Cancelled meetings say so in `title` ("CANCELLED- Regular City Council
Meeting"). Meetings of all bodies are mixed together; filter on `title`/`committeeId`.

## Not built tonight

- CivicClerk and PrimeGov readers (8 cities, including Los Alamitos and Santa Ana). Both fit the
  existing JSON shape in `ca-orange-city-agendas.json`; PrimeGov would need its HTML agenda parsed
  for items.
- Granicus and Agenda Center RSS could give meeting date and agenda link only (no items) for 6
  more cities.
- Anaheim, Cypress, Laguna Woods, Rancho Santa Margarita, San Juan Capistrano: system not
  identified. Anaheim's and Cypress's websites refuse automated requests.
