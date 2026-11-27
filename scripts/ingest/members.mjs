// Ingest members of Congress and all of their terms: everyone serving now, plus anyone
// who served from the 118th Congress (2023) on, so their recorded votes have a member.
// Source: unitedstates/congress-legislators (public domain).
//
//   node scripts/ingest/members.mjs             # write to Supabase
//   node scripts/ingest/members.mjs --dry-run   # fetch + map only, print counts
//   node scripts/ingest/members.mjs --dry-run --dir local/ --out rows.json
//
// Also loads leadership_roles (Speaker, floor leaders, whips, conference officers).
// Idempotent: rows are inserted or updated only when something changed. Members who
// leave Congress are kept (their votes and history still reference them).
import { readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";
import { getClient, fetchAll, upsertBatches, withRun, changed } from "./lib.mjs";

const BASE = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/";
const HISTORY_FROM = "2023-01-03"; // start of the 118th Congress

const MEMBER_FIELDS = [
  "lis_id", "govtrack_id", "thomas_id", "icpsr_id", "wikidata_id", "fec_candidate_ids",
  "first_name", "middle_name", "last_name", "suffix", "nickname", "official_full_name",
  "birthday", "gender", "source_url",
  "social_x", "social_facebook", "social_youtube", "social_instagram", "social_mastodon", "social_bluesky",
];
const TERM_FIELDS = [
  "state", "district", "senate_class", "state_rank", "party", "caucus", "end_date", "how", "url",
  "phone", "address", "contact_form",
];

// Official accounts from legislators-social-media.yaml, keyed by bioguide ID.
export function mapSocial(entries) {
  const out = new Map();
  for (const e of entries ?? []) {
    const s = e.social ?? {};
    out.set(e.id?.bioguide, {
      social_x: s.twitter ?? null, social_facebook: s.facebook ?? null, social_youtube: s.youtube ?? s.youtube_id ?? null,
      social_instagram: s.instagram ?? null, social_mastodon: s.mastodon ?? null, social_bluesky: s.bluesky ?? null,
    });
  }
  return out;
}

const NO_SOCIAL = { social_x: null, social_facebook: null, social_youtube: null, social_instagram: null, social_mastodon: null, social_bluesky: null };

export function mapLegislators(legislators, social = new Map()) {
  const members = [];
  const terms = [];
  const periods = [];
  for (const m of legislators) {
    const id = m.id;
    members.push({
      bioguide_id: id.bioguide,
      lis_id: id.lis ?? null,
      govtrack_id: id.govtrack ?? null,
      thomas_id: id.thomas ?? null,
      icpsr_id: id.icpsr ?? null,
      wikidata_id: id.wikidata ?? null,
      fec_candidate_ids: id.fec ?? [],
      first_name: m.name.first,
      middle_name: m.name.middle ?? null,
      last_name: m.name.last,
      suffix: m.name.suffix ?? null,
      nickname: m.name.nickname ?? null,
      official_full_name: m.name.official_full ?? null,
      birthday: m.bio?.birthday ?? null,
      gender: m.bio?.gender ?? null,
      source_url: `https://bioguide.congress.gov/search/bio/${id.bioguide}`,
      ...(social.get(id.bioguide) ?? NO_SOCIAL),
    });
    for (const t of m.terms) {
      const house = t.type === "rep";
      terms.push({
        bioguide_id: id.bioguide,
        chamber: house ? "house" : "senate",
        state: t.state,
        district: house ? t.district : null,
        senate_class: house ? null : t.class ?? null,
        state_rank: t.state_rank ?? null,
        party: t.party,
        caucus: t.caucus ?? null, // set for independents: the party they caucus with
        start_date: t.start,
        end_date: t.end,
        how: t.how ?? null,
        url: t.url ?? null,
        phone: t.phone ?? null,
        address: t.address ?? null,
        contact_form: t.contact_form ?? null,
      });
      periods.push(...mapPartyPeriods(id.bioguide, house ? "house" : "senate", t));
    }
  }
  return { members, terms, periods, roles: mapLeadership(legislators) };
}

// A term's party_affiliations (listed only when the member changed party during the term), one
// row per stretch, dates as the source gives them. The term's own `party` is the last one listed,
// so a term without this list had one party throughout and gets no rows.
export function mapPartyPeriods(bioguide_id, chamber, t) {
  return (t.party_affiliations ?? []).filter((p) => p.start && p.end && p.party).map((p) => ({
    bioguide_id, chamber, term_start_date: t.start,
    start_date: p.start, end_date: p.end, party: p.party, caucus: p.caucus ?? null,
  }));
}
export const periodKey = (p) => `${p.bioguide_id}|${p.chamber}|${p.term_start_date}|${p.start_date}`;
const PERIOD_FIELDS = ["end_date", "party", "caucus"];

// Leadership posts (Speaker, floor leaders, whips, conference officers), title verbatim.
// The same title starting on the same day twice for one member is one row.
export function mapLeadership(legislators) {
  const rows = new Map();
  for (const m of legislators) {
    for (const r of m.leadership_roles ?? []) {
      if (!r.title || !r.start || !["house", "senate"].includes(r.chamber)) continue;
      const row = { bioguide_id: m.id.bioguide, chamber: r.chamber, title: r.title, start_date: r.start, end_date: r.end ?? null };
      rows.set(roleKey(row), row);
    }
  }
  return [...rows.values()];
}
const ROLE_FIELDS = ["chamber", "end_date", "correction_source"];

// Our corrections (data/corrections/leadership.json), each tied to an official source. One the
// dataset already reflects is left out and reported, so it can be deleted from the file.
export function applyLeadershipCorrections(roles, corrections) {
  const out = roles.map((r) => ({ ...r, correction_source: null }));
  const retired = [];
  for (const c of corrections) {
    if (c.action === "end") {
      const r = out.find((x) => x.bioguide_id === c.bioguide_id && x.title === c.title && x.start_date === c.start_date);
      if (!r || r.end_date) { retired.push(c); continue; }
      Object.assign(r, { end_date: c.end_date, correction_source: c.source });
    } else if (c.action === "add") {
      if (out.some((x) => x.bioguide_id === c.bioguide_id && x.title === c.title)) { retired.push(c); continue; }
      out.push({ bioguide_id: c.bioguide_id, chamber: c.chamber, title: c.title, start_date: c.start_date, end_date: c.end_date ?? null, correction_source: c.source });
    }
  }
  return { roles: out, retired };
}
export const roleKey = (r) => `${r.bioguide_id}|${r.title}|${r.start_date}`;

async function load(name, dir) {
  if (dir) return YAML.parse(readFileSync(`${dir}/${name}`, "utf8"));
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`fetch ${name}: HTTP ${res.status}`);
  return YAML.parse(await res.text());
}

const termKey = (t) => `${t.bioguide_id}|${t.chamber}|${t.start_date}`;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

  const current = await load("legislators-current.yaml", arg("--dir"));
  const recentFormer = (await load("legislators-historical.yaml", arg("--dir")))
    .filter((m) => m.terms.at(-1).end >= HISTORY_FROM);
  const social = mapSocial(await load("legislators-social-media.yaml", arg("--dir")));
  const mapped = mapLegislators([...current, ...recentFormer], social);
  const { members, terms, periods } = mapped;
  const corrections = JSON.parse(readFileSync(new URL("../../data/corrections/leadership.json", import.meta.url), "utf8")).corrections;
  const { roles, retired } = applyLeadershipCorrections(mapped.roles, corrections);
  for (const c of retired) console.log(`correction no longer needed (dataset has it; delete from data/corrections/leadership.json): ${c.action} ${c.bioguide_id} ${c.title}`);
  console.log(`source: ${current.length} current + ${recentFormer.length} former members, ${terms.length} terms (${periods.length} party periods), ${roles.length} leadership roles`);

  if (dryRun) {
    if (arg("--out")) writeFileSync(arg("--out"), JSON.stringify({ members, terms, periods, roles }));
    console.log("dry run: nothing written");
    return;
  }

  const db = getClient();
  const counts = await withRun(db, "members", async () => {
    const existingMembers = new Map(
      (await fetchAll(db, "members", ["bioguide_id", ...MEMBER_FIELDS].join(","))).map((r) => [r.bioguide_id, r])
    );
    const existingTerms = new Map(
      (await fetchAll(db, "terms", ["bioguide_id", "chamber", "start_date", ...TERM_FIELDS].join(","))).map((r) => [termKey(r), r])
    );

    const memberWrites = members.filter((m) => {
      const prev = existingMembers.get(m.bioguide_id);
      return !prev || changed(m, prev, MEMBER_FIELDS);
    });
    const termWrites = terms.filter((t) => {
      const prev = existingTerms.get(termKey(t));
      return !prev || changed(t, prev, TERM_FIELDS);
    });

    // Members first: terms reference them.
    await upsertBatches(db, "members", memberWrites, "bioguide_id");
    await upsertBatches(db, "terms", termWrites, "bioguide_id,chamber,start_date");

    const leadership = await syncLeadership(db, roles);
    const party = await syncPartyPeriods(db, periods);

    const inserted =
      memberWrites.filter((m) => !existingMembers.has(m.bioguide_id)).length +
      termWrites.filter((t) => !existingTerms.has(termKey(t))).length + leadership.inserted + party.inserted;
    return {
      rows_inserted: inserted,
      rows_updated: memberWrites.length + termWrites.length + leadership.written + party.written - inserted,
      rows_deleted: leadership.deleted + party.deleted,
    };
  });
  console.log(`done: ${counts.rows_inserted} inserted, ${counts.rows_updated} updated`);
}

// Mirror the source: write new or changed roles, delete roles the source no longer lists (all
// members we load are loaded in full, so a missing role was removed or corrected upstream).
async function syncLeadership(db, roles) {
  const { error: missing } = await db.from("leadership_roles").select("bioguide_id").limit(1);
  if (missing && !/schema cache|does not exist/i.test(missing.message)) throw new Error(`read leadership_roles: ${missing.message}`);
  if (missing) {
    // Migration not applied yet: keep the members run working and say so in the log.
    console.warn(`leadership_roles skipped: ${String(missing.message).slice(0, 120)}`);
    return { inserted: 0, written: 0, deleted: 0 };
  }
  const existing = new Map((await fetchAll(db, "leadership_roles", "bioguide_id,title,start_date,chamber,end_date,correction_source")).map((r) => [roleKey(r), r]));
  const writes = roles.filter((r) => !existing.has(roleKey(r)) || changed(r, existing.get(roleKey(r)), ROLE_FIELDS));
  await upsertBatches(db, "leadership_roles", writes, "bioguide_id,title,start_date");
  const keep = new Set(roles.map(roleKey));
  const stale = [...existing.values()].filter((r) => !keep.has(roleKey(r)));
  for (const r of stale) {
    const { error } = await db.from("leadership_roles").delete()
      .eq("bioguide_id", r.bioguide_id).eq("title", r.title).eq("start_date", r.start_date);
    if (error) throw new Error(`delete leadership_roles: ${error.message}`);
  }
  const inserted = writes.filter((r) => !existing.has(roleKey(r))).length;
  console.log(`leadership roles: ${inserted} inserted, ${writes.length - inserted} updated, ${stale.length} deleted`);
  return { inserted, written: writes.length, deleted: stale.length };
}

// Mirror the source's party_affiliations (after terms: each row references its term). A row the
// source no longer lists is deleted, the same rule as leadership roles.
async function syncPartyPeriods(db, periods) {
  const { error: missing } = await db.from("term_party_periods").select("bioguide_id").limit(1);
  if (missing && !/schema cache|does not exist/i.test(missing.message)) throw new Error(`read term_party_periods: ${missing.message}`);
  if (missing) {
    console.warn(`term_party_periods skipped: ${String(missing.message).slice(0, 120)}`);
    return { inserted: 0, written: 0, deleted: 0 };
  }
  const existing = new Map((await fetchAll(db, "term_party_periods", "bioguide_id,chamber,term_start_date,start_date,end_date,party,caucus")).map((r) => [periodKey(r), r]));
  const writes = periods.filter((p) => !existing.has(periodKey(p)) || changed(p, existing.get(periodKey(p)), PERIOD_FIELDS));
  await upsertBatches(db, "term_party_periods", writes, "bioguide_id,chamber,term_start_date,start_date");
  const keep = new Set(periods.map(periodKey));
  const stale = [...existing.values()].filter((r) => !keep.has(periodKey(r)));
  for (const r of stale) {
    const { error } = await db.from("term_party_periods").delete()
      .eq("bioguide_id", r.bioguide_id).eq("chamber", r.chamber).eq("term_start_date", r.term_start_date).eq("start_date", r.start_date);
    if (error) throw new Error(`delete term_party_periods: ${error.message}`);
  }
  const inserted = writes.filter((p) => !existing.has(periodKey(p))).length;
  console.log(`party periods: ${inserted} inserted, ${writes.length - inserted} updated, ${stale.length} deleted`);
  return { inserted, written: writes.length, deleted: stale.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
