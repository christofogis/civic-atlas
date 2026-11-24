// Temporary probe: what bill text versions GovInfo offers and how the XML is structured.
const UA = { headers: { "User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)" } };
for (const id of ["119/s/BILLSTATUS-119s5", "119/hr/BILLSTATUS-119hr1", "118/hr/BILLSTATUS-118hr2882"]) {
  const x = await (await fetch(`https://www.govinfo.gov/bulkdata/BILLSTATUS/${id}.xml`, UA)).text();
  const bill = x.split("<amendments>")[0];
  const tv = bill.match(/<textVersions>[\s\S]*?<\/textVersions>/g) ?? [];
  console.log("=====", id, "textVersions blocks:", tv.length);
  console.log(tv.map((t) => t.slice(0, 3000)).join("\n---\n"));
}
for (const u of ["https://www.govinfo.gov/content/pkg/BILLS-119s5is/xml/BILLS-119s5is.xml", "https://www.govinfo.gov/content/pkg/BILLS-119s5enr/xml/BILLS-119s5enr.xml"]) {
  const r = await fetch(u, UA); const x = await r.text();
  console.log("=====", u, r.status, x.length);
  const tags = {}; for (const m of x.matchAll(/<([a-zA-Z:-]+)[\s>]/g)) tags[m[1]] = (tags[m[1]] ?? 0) + 1;
  console.log(JSON.stringify(tags));
  console.log(x.slice(0, 2500)); console.log("...."); console.log(x.slice(Math.floor(x.length / 2), Math.floor(x.length / 2) + 2500));
}
