// Developer probe: print the start of each official schedule feed to design the parser.
const UA = { headers: { "User-Agent": "civic-atlas (github.com/christofogis/civic-atlas)" } };
const show = async (label, url, n = 2500) => {
  const r = await fetch(url, UA);
  const t = await r.text();
  console.log(`\n===== ${label} ${r.status} ${url}\n${t.slice(0, n)}`);
  return t;
};
const monday = (d) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10).replace(/-/g, ""); };
for (const wk of [monday(new Date("2026-11-16")), monday(new Date())]) {
  await show(`House floor ${wk}`, `https://docs.house.gov/floor/Download.aspx?file=/billsthisweek/${wk}/${wk}.xml`, 3000);
}
await show("Senate floor", "https://www.senate.gov/legislative/schedule/floor_schedule.xml", 3000);
await show("Senate hearings", "https://www.senate.gov/general/committee_schedules/hearings.xml", 3000);
const rss = await show("House WM RSS", "https://docs.house.gov/Committee/RSS.ashx?Code=WM00", 1500);
const m = rss.match(/url="([^"]+\.xml)"/);
if (m) await show("House meeting XML", m[1], 4000);
