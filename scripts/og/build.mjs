// Link-preview cards for record pages, drawn at deploy time into dist/og/ (after `vite build`):
//   /og/member/{bioguide}.png          every member in member_directory (since the 118th Congress)
//   /og/bill/{congress}-{type}-{n}.png bills that became law or have a roll call
//   /og/committee/{id}.png             every committee and subcommittee
//   /og/state/{uuid}.png               active state officials
//   /og/ballot/{year}.png              On the ballot, 2024 to two elections ahead
// lib/pageMeta.js points og:image at these paths; lib/seoPage.js checks the file exists and falls
// back to the generic card (/og/site.png) for anything not drawn here (a bill without votes, a
// record added since the last deploy, or a build where this step failed).
//
// Why at build time: a Pages Function can't render a PNG within the free plan's 10 ms CPU, social
// sites don't accept SVG previews, and committing ~10,000 PNGs that change with the data would bloat
// the repository. Cloudflare Pages rebuilds on every push to main (at least twice a day, with the
// Orange County agenda commits), so cards are as fresh as the last deploy. Rendering is deterministic,
// so unchanged cards upload nothing new.
//
// Runs only on Cloudflare Pages (CF_PAGES=1) or with OG_CARDS=1; a plain `npm run build` skips it.
// Never fails the build: on any error it logs and leaves the generic card in place.
// Options (env): OG_LIMIT=n (cards per kind, for trial runs), OG_KINDS=member,bill (subset),
// OG_MAX_SECONDS (default 600: drawing stops there and the cards not drawn use the generic image).
import { mkdirSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { availableParallelism } from "node:os";
import { Worker } from "node:worker_threads";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../src/lib/config.js";
import { memberCard, billCard, committeeCard, statePersonCard, ballotCard } from "../../lib/ogCard.js";
import { nextElectionYear } from "../../lib/upForElection.js";

const OUT = new URL("../../dist/", import.meta.url);
const PAGE = 1000;
const BILL_FIELDS = "congress,bill_type,number,title,short_title,introduced_date,reported_date,passed_house_date,failed_house_date,passed_senate_date,failed_senate_date,presented_date,vetoed_date,became_law_date,law_number";
const LIMIT = Number(process.env.OG_LIMIT) || Infinity;
const MAX_SECONDS = Number(process.env.OG_MAX_SECONDS) || 600;   // keep the deploy well inside Pages' 20-minute build limit
const KINDS = new Set((process.env.OG_KINDS || "member,bill,committee,state,ballot").split(","));

async function rest(path, attempt = 1) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(30000) });
  if (res.ok) return res.json();
  if (attempt < 3 && res.status >= 500) { await new Promise((r) => setTimeout(r, 2000 * attempt)); return rest(path, attempt + 1); }
  throw new Error(`database ${res.status} for ${path.split("?")[0]}`);
}
async function all(path) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await rest(`${path}&limit=${PAGE}&offset=${offset}`);
    rows.push(...page);
    if (page.length < PAGE || rows.length >= LIMIT) return rows.slice(0, LIMIT);
  }
}

// Bills that became law, plus bills with at least one roll call.
async function bills() {
  const laws = await all(`bills?law_number=not.is.null&select=${BILL_FIELDS}&order=congress,bill_type,number`);
  const have = new Set(laws.map((b) => `${b.congress}|${b.bill_type}|${b.number}`));
  const voted = await all("votes?bill_number=not.is.null&select=bill_congress,bill_type,bill_number&order=vote_id");
  const want = new Map();
  for (const v of voted) {
    const k = `${v.bill_congress}|${v.bill_type}|${v.bill_number}`;
    if (have.has(k)) continue;
    have.add(k);
    const g = `${v.bill_congress}|${v.bill_type}`;
    if (!want.has(g)) want.set(g, []);
    want.get(g).push(v.bill_number);
  }
  const out = [...laws];
  for (const [g, numbers] of want) {
    const [congress, type] = g.split("|");
    for (let i = 0; i < numbers.length; i += 150)
      out.push(...await rest(`bills?congress=eq.${congress}&bill_type=eq.${type}&number=in.(${numbers.slice(i, i + 150).join(",")})&select=${BILL_FIELDS}`));
  }
  return out.slice(0, LIMIT);
}

// Official portraits (public domain), fetched a few at a time. Missing ones (newer members the
// images repository doesn't have yet) get the same card without a photo.
async function portraits(ids) {
  const out = new Map();
  let i = 0, missing = 0;
  const one = async () => {
    while (i < ids.length) {
      const id = ids[i++];
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const res = await fetch(`https://unitedstates.github.io/images/congress/450x550/${id}.jpg`, { signal: AbortSignal.timeout(15000) });
          if (res.status === 404) { missing++; break; }
          if (!res.ok) throw new Error(String(res.status));
          out.set(id, Buffer.from(await res.arrayBuffer()));
          break;
        } catch (e) { if (attempt === 2) { missing++; console.log(`og: portrait ${id} not fetched (${e.message})`); } }
      }
    }
  };
  await Promise.all(Array.from({ length: 12 }, one));
  console.log(`og: ${out.size} portraits, ${missing} without one`);
  return out;
}

// Spread the drawing over worker threads; each writes its own files.
async function draw(jobs) {
  const n = Math.max(1, Math.min(availableParallelism(), 8, Math.ceil(jobs.length / 200)));
  console.log(`og: drawing ${jobs.length} cards on ${n} threads`);
  const slices = Array.from({ length: n }, (_, k) => jobs.filter((_, j) => j % n === k));
  const workers = [];
  const timer = setTimeout(() => { console.log(`og: time limit (${MAX_SECONDS} s) reached; stopping`); for (const w of workers) w.terminate(); }, MAX_SECONDS * 1000);
  const results = await Promise.all(slices.map((slice, id) => new Promise((resolve) => {
    const w = new Worker(new URL("./worker.mjs", import.meta.url), { workerData: { id, jobs: slice, out: OUT.pathname } });
    workers.push(w);
    w.on("message", resolve);
    w.on("error", (e) => { console.log(`og: worker failed: ${e.message}`); resolve({ written: 0, failed: slice.length }); });
    w.on("exit", () => resolve({ written: 0, failed: slice.length }));   // stopped at the time limit (counts are approximate)
  })));
  clearTimeout(timer);
  return results.reduce((a, r) => ({ written: a.written + r.written, failed: a.failed + r.failed }), { written: 0, failed: 0 });
}

async function main() {
  if (process.env.CF_PAGES !== "1" && process.env.OG_CARDS !== "1") {
    console.log("og: skipped (runs on Cloudflare Pages, or set OG_CARDS=1)");
    return;
  }
  if (!existsSync(OUT)) throw new Error("dist/ not found: run vite build first");
  const t0 = Date.now();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
  const jobs = [];
  const add = (spec, portrait) => jobs.push({ spec, portrait: portrait ?? null });

  if (KINDS.has("member")) {
    const rows = await all("member_directory?select=bioguide_id,name,chamber,state,district,party,start_date,end_date&order=bioguide_id");
    const photos = await portraits(rows.map((r) => r.bioguide_id));
    for (const r of rows) { const p = photos.get(r.bioguide_id); add(memberCard(r, { today, portrait: Boolean(p) }), p); }
  }
  if (KINDS.has("bill")) for (const b of await bills()) add(billCard(b, { today }));
  if (KINDS.has("committee")) for (const c of await all("committees?select=committee_id,chamber,name,parent:parent_id(name)&order=committee_id")) add(committeeCard(c));
  if (KINDS.has("state")) for (const p of await all("state_people?active=is.true&select=id,name,state,party,active,state_roles(type,district,start_date,end_date)&order=id")) add(statePersonCard(p, { today }));
  if (KINDS.has("ballot")) for (let y = 2024; y <= nextElectionYear(today) + 2; y += 2) add(ballotCard(y));

  for (const dir of new Set(jobs.map((j) => j.spec.path.split("/")[2]))) mkdirSync(new URL(`og/${dir}/`, OUT), { recursive: true });
  const { written, failed } = await draw(jobs);
  for (const dir of readdirSync(new URL("og/", OUT))) {
    if (!dir.includes(".")) for (const f of readdirSync(new URL(`og/${dir}/`, OUT))) if (f.endsWith(".tmp")) unlinkSync(new URL(`og/${dir}/${f}`, OUT));
  }
  const counts = jobs.reduce((m, j) => ({ ...m, [j.spec.kind]: (m[j.spec.kind] ?? 0) + 1 }), {});
  console.log(`og: ${written} cards written, ${failed} failed, in ${Math.round((Date.now() - t0) / 1000)} s (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")})`);
  writeFileSync(new URL("og/cards.json", OUT), JSON.stringify({ built: new Date().toISOString(), counts, written, failed }));
}

main().catch((e) => {
  // The site works without per-page cards (the generic card is used), so don't fail the deploy.
  console.log(`og: cards not built: ${e.message}`);
});
