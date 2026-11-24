// Temporary probe: what bill text versions GovInfo offers and how the XML is structured.
const UA = { headers: { "User-Agent": "civic-atlas probe (github.com/christofogis/civic-atlas)" } };
for (const id of ["119/s/BILLSTATUS-119s5", "119/hr/BILLSTATUS-119hr1"]) {
  const x = await (await fetch(`https://www.govinfo.gov/bulkdata/BILLSTATUS/${id}.xml`, UA)).text();
  const tv = (x.match(/<textVersions>[\s\S]*?<\/textVersions>/g) ?? []).filter((t) => t.includes("<item>"));
  console.log("=====", id, "blocks with items:", tv.length);
  console.log(tv.map((t) => t.slice(0, 2500)).join("\n---\n"));
}
for (const u of ["https://www.govinfo.gov/bulkdata/json/BILLS/119/1/s", "https://www.govinfo.gov/bulkdata/json/BILLS"]) {
  const r = await fetch(u, { headers: { ...UA.headers, Accept: "application/json" } }); const t = await r.text();
  console.log("=====", u, r.status, t.length); console.log(t.slice(0, 1500));
}
const x = await (await fetch("https://www.govinfo.gov/content/pkg/BILLS-119s5enr/xml/BILLS-119s5enr.xml", UA)).text();
console.log("===== s5enr body"); console.log(x.slice(x.indexOf("<legis-body"), x.indexOf("<legis-body") + 4000));
