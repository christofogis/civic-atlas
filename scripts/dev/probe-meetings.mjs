// Temporary probe: Congress.gov committee-meeting coverage for House vs Senate.
const KEY = process.env.DATA_GOV_API_KEY;
const get = async (u) => { const r = await fetch(`${u}${u.includes("?") ? "&" : "?"}format=json&api_key=${KEY}`); return [r.status, await r.json().catch(() => null)]; };
for (const ch of ["house", "senate"]) {
  const [st, list] = await get(`https://api.congress.gov/v3/committee-meeting/119/${ch}?limit=250`);
  const items = list?.committeeMeetings ?? [];
  console.log("=====", ch, st, "listed:", items.length, "pagination:", JSON.stringify(list?.pagination));
  const sample = items.slice(0, 40);
  let witnesses = 0, videos = 0, docs = 0, hearingTr = 0, n = 0;
  for (const m of sample) {
    const [s, d] = await get(m.url);
    const cm = d?.committeeMeeting; if (!cm) continue; n++;
    if ((cm.witnesses ?? []).length) witnesses++;
    if ((cm.videos ?? []).length) videos++;
    if ((cm.witnessDocuments ?? []).length || (cm.meetingDocuments ?? []).length) docs++;
    if ((cm.hearingTranscript ?? []).length) hearingTr++;
    if (n <= 2) console.log(JSON.stringify(cm).slice(0, 2500));
  }
  console.log(`${ch}: of ${n} detailed: witnesses ${witnesses}, videos ${videos}, documents ${docs}, transcripts ${hearingTr}`);
}
