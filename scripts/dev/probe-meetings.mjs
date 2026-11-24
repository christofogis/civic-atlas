// Temporary probe: older Senate meetings — any witnesses? And a full House record.
const KEY = process.env.DATA_GOV_API_KEY;
const get = async (u) => { const r = await fetch(`${u}${u.includes("?") ? "&" : "?"}format=json&api_key=${KEY}`); return [r.status, await r.json().catch(() => null)]; };
for (const [c, off] of [[119, 900], [118, 500], [118, 1200]]) {
  const [, list] = await get(`https://api.congress.gov/v3/committee-meeting/${c}/senate?limit=60&offset=${off}`);
  let n = 0, w = 0, past = 0, hearings = 0, docTypes = {};
  for (const m of list?.committeeMeetings ?? []) {
    const [, d] = await get(m.url); const cm = d?.committeeMeeting; if (!cm) continue; n++;
    if (new Date(cm.date) < new Date()) past++;
    if (/hearing/i.test(cm.type ?? "")) hearings++;
    if ((cm.witnesses ?? []).length) { w++; if (w === 1) console.log("SENATE WITNESS SAMPLE", JSON.stringify(cm.witnesses).slice(0, 600)); }
    for (const doc of cm.meetingDocuments ?? []) docTypes[doc.documentType] = (docTypes[doc.documentType] ?? 0) + 1;
    for (const doc of cm.witnessDocuments ?? []) docTypes["W:" + doc.documentType] = (docTypes["W:" + doc.documentType] ?? 0) + 1;
  }
  console.log(`senate ${c} offset ${off}: ${n} meetings, ${past} past, ${hearings} hearings, ${w} with witnesses, docs ${JSON.stringify(docTypes)}`);
}
const [, hl] = await get(`https://api.congress.gov/v3/committee-meeting/119/house?limit=20&offset=600`);
for (const m of (hl?.committeeMeetings ?? []).slice(0, 20)) {
  const [, d] = await get(m.url); const cm = d?.committeeMeeting;
  if ((cm?.witnesses ?? []).length) { console.log("HOUSE FULL", JSON.stringify(cm).slice(0, 5000)); break; }
}
