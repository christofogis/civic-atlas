// Ingest current members of Congress and all of their terms.
// Source: unitedstates/congress-legislators (public domain).
//
//   node scripts/ingest/members.mjs             # write to Supabase
//   node scripts/ingest/members.mjs --dry-run   # fetch + map only, print counts
//   node scripts/ingest/members.mjs --dry-run --file local.yaml --out rows.json
//
// Idempotent: rows are inserted or updated only when something changed. Members who
// leave Congress are kept (their votes and history still reference them).
import { readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";
import { getClient, fetchAll, upsertBatches, withRun, changed } from "./lib.mjs";

const SOURCE_URL =
  "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/legislators-current.yaml";

const MEMBER_FIELDS = [
  "lis_id", "govtrack_id", "thomas_id", "icpsr_id", "wikidata_id", "fec_candidate_ids",
  "first_name", "middle_name", "last_name", "suffix", "nickname", "official_full_name",
  "birthday", "gender", "source_url",
];
const TERM_FIELDS = [
  "state", "district", "senate_class", "state_rank", "party", "end_date", "how", "url",
];

export function mapLegislators(legislators) {
  const members = [];
  const terms = [];
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
        start_date: t.start,
        end_date: t.end,
        how: t.how ?? null,
        url: t.url ?? null,
      });
    }
  }
  return { members, terms };
}

async function loadSource(file) {
  if (file) return readFileSync(file, "utf8");
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`fetch source: HTTP ${res.status}`);
  return res.text();
}

const termKey = (t) => `${t.bioguide_id}|${t.chamber}|${t.start_date}`;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);

  const { members, terms } = mapLegislators(YAML.parse(await loadSource(arg("--file"))));
  console.log(`source: ${members.length} members, ${terms.length} terms`);

  if (dryRun) {
    if (arg("--out")) writeFileSync(arg("--out"), JSON.stringify({ members, terms }));
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

    const inserted =
      memberWrites.filter((m) => !existingMembers.has(m.bioguide_id)).length +
      termWrites.filter((t) => !existingTerms.has(termKey(t))).length;
    return { rows_inserted: inserted, rows_updated: memberWrites.length + termWrites.length - inserted };
  });
  console.log(`done: ${counts.rows_inserted} inserted, ${counts.rows_updated} updated`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
