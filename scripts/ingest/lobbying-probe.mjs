// Developer probe for the LDA.gov filings API: page size, filters, volume, sample descriptions.
// Writes nothing. Usage: node scripts/ingest/lobbying-probe.mjs
const BASE = "https://lda.gov/api/v1";
const key = process.env.LDA_API_KEY;
const headers = { Accept: "application/json", ...(key ? { Authorization: `Token ${key}` } : {}) };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  const res = await fetch(`${BASE}${path}`, { headers });
  const text = await res.text();
  console.log(`GET ${path} -> ${res.status} (${text.length} bytes)`,
    ["x-ratelimit-limit", "x-ratelimit-remaining", "retry-after"].map((h) => `${h}=${res.headers.get(h)}`).join(" "));
  await sleep(4500);
  try { return JSON.parse(text); } catch { console.log(text.slice(0, 300)); return null; }
}

console.log("api key present:", Boolean(key));
for (const size of [25, 100, 1000]) {
  const d = await get(`/filings/?filing_year=2025&filing_period=first_quarter&page_size=${size}`);
  console.log(`page_size=${size}: count=${d?.count} returned=${d?.results?.length}`);
}
const types = await get("/constants/filing/filingtypes/");
console.log("filing types:", JSON.stringify(types));
for (const t of ["Q1", "1A", "1T"]) {
  const d = await get(`/filings/?filing_year=2025&filing_type=${t}&page_size=1`);
  console.log(`2025 type ${t}: count=${d?.count}`);
}
const recent = await get("/filings/?filing_dt_posted_after=2026-11-01&page_size=1&ordering=dt_posted");
console.log("posted after 2026-11-01:", recent?.count, recent?.results?.[0]?.dt_posted);
const ord = await get("/filings/?filing_year=2025&filing_period=second_quarter&ordering=-dt_posted&page_size=1");
console.log("ordering -dt_posted first:", ord?.results?.[0]?.dt_posted);

const sample = await get("/filings/?filing_year=2025&filing_period=third_quarter&filing_type=Q3&page_size=40");
for (const f of sample?.results ?? []) {
  for (const a of f.lobbying_activities ?? []) {
    console.log(`\n[${f.filing_type} ${f.client?.name} | reg ${f.registrant?.id} client ${f.client?.id} | ${a.general_issue_code}]`);
    console.log(String(a.description ?? "").slice(0, 400));
  }
}
