// Developer probe: print the action list of a few Bill Status files, to design the status bar.
import { XMLParser } from "fast-xml-parser";
const parser = new XMLParser({ ignoreAttributes: true });
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
for (const f of ["119/hr/BILLSTATUS-119hr1.xml", "118/hr/BILLSTATUS-118hr2670.xml", "119/hres/BILLSTATUS-119hres5.xml", "118/hjres/BILLSTATUS-118hjres98.xml", "119/s/BILLSTATUS-119s5.xml"]) {
  const xml = await (await fetch(`https://www.govinfo.gov/bulkdata/BILLSTATUS/${f}`)).text();
  const b = parser.parse(xml)?.billStatus?.bill;
  console.log(`\n== ${f}  laws=${JSON.stringify(b?.laws)}`);
  const acts = list(b?.actions?.item);
  for (const a of acts.slice().reverse()) {
    console.log([a.actionDate, a.type, a.actionCode, a.sourceSystem?.code, String(a.text).slice(0, 110)].join(" | "));
  }
}
