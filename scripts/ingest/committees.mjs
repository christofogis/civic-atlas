// Ingest committees, subcommittees, and current committee assignments.
// Source: unitedstates/congress-legislators (public domain). Run after members.mjs.
//
//   node scripts/ingest/committees.mjs
//   node scripts/ingest/committees.mjs --dry-run [--dir local/] [--out rows.json]
//
// The membership file is a snapshot of "current" assignments with no Congress number,
// so rows are tagged with the Congress in session today. If the file is stale (e.g. the
// weeks after Jan 3 before new assignments are published), most listed members won't be
// serving and the membership write is skipped rather than mislabeled.
import { readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";
import { getClient, fetchAll, upsertBatches, withRun, changed } from "./lib.mjs";

const BASE = "https://raw.githubusercontent.com/unitedstates/congress-legislators/main/";
const STALE_THRESHOLD = 0.02; // skip memberships if >2% of rows reference non-serving members

const COMMITTEE_FIELDS = ["parent_id", "chamber", "name", "url", "source_url"];
const MEMBERSHIP_FIELDS = ["side", "rank", "title"];

export function mapCommittees(committees) {
  const parents = [];
  const subs = [];
  for (const c of committees) {
    const source_url = BASE + "committees-current.yaml";
    parents.push({
      committee_id: c.thomas_id, parent_id: null, chamber: c.type,
      name: c.name, url: c.url ?? null, source_url,
    });
    for (const s of c.subcommittees ?? []) {
      subs.push({
        committee_id: c.thomas_id + s.thomas_id, parent_id: c.thomas_id, chamber: c.type,
        name: s.name, url: null, source_url,
      });
    }
  }
  return { parents, subs };
}

export function mapMemberships(membership, congress) {
  const rows = [];
  for (const [committee_id, list] of Object.entries(membership)) {
    for (const m of list) {
      rows.push({
        congress, committee_id, bioguide_id: m.bioguide,
        side: m.party ?? null, rank: m.rank ?? null, title: m.title ?? null,
      });
    }
  }
  return rows;
}

async function load(name, dir) {
  if (dir) return YAML.parse(readFileSync(`${dir}/${name}`, "utf8"));
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`fetch ${name}: HTTP ${res.status}`);
  return YAML.parse(await res.text());
}

const key = (r) => `${r.committee_id}|${r.bioguide_id}`;

async function main() {
  const args = process.argv.slice(2);
  const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
  const dir = arg("--dir");

  const { parents, subs } = mapCommittees(await load("committees-current.yaml", dir));
  const membershipSource = await load("committee-membership-current.yaml", dir);
  console.log(`source: ${parents.length} committees, ${subs.length} subcommittees`);

  if (args.includes("--dry-run")) {
    const rows = mapMemberships(membershipSource, null);
    console.log(`source: ${rows.length} assignments`);
    if (arg("--out")) writeFileSync(arg("--out"), JSON.stringify({ parents, subs, memberships: rows }));
    console.log("dry run: nothing written");
    return;
  }

  const db = getClient();
  const counts = await withRun(db, "committees", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: cong, error } = await db.from("congresses").select("number")
      .lte("start_date", today).gt("end_date", today).single();
    if (error) throw new Error(`no congress covers ${today}; add it to congresses`);
    const congress = cong.number;

    // Committees: write new or changed rows; keep ones that disappear (history).
    const existing = new Map(
      (await fetchAll(db, "committees", ["committee_id", ...COMMITTEE_FIELDS].join(","))).map((r) => [r.committee_id, r])
    );
    const pick = (rows) => rows.filter((r) => !existing.has(r.committee_id) || changed(r, existing.get(r.committee_id), COMMITTEE_FIELDS));
    const parentWrites = pick(parents);
    const subWrites = pick(subs);
    await upsertBatches(db, "committees", parentWrites, "committee_id"); // parents before subs
    await upsertBatches(db, "committees", subWrites, "committee_id");
    let inserted = [...parentWrites, ...subWrites].filter((r) => !existing.has(r.committee_id)).length;
    let updated = parentWrites.length + subWrites.length - inserted;

    // Memberships: only for members serving today, and only if the snapshot isn't stale.
    const serving = new Set(
      (await fetchAll(db, "seat_holders", "bioguide_id,seat_status"))
        .filter((r) => r.seat_status === "serving").map((r) => r.bioguide_id)
    );
    const all = mapMemberships(membershipSource, congress);
    const rows = all.filter((r) => serving.has(r.bioguide_id));
    const staleShare = 1 - rows.length / all.length;
    if (staleShare > STALE_THRESHOLD) {
      console.log(`membership snapshot looks stale for Congress ${congress} ` +
        `(${(staleShare * 100).toFixed(1)}% of rows are non-serving members); skipped`);
      return { rows_inserted: inserted, rows_updated: updated, rows_deleted: 0 };
    }

    const prev = new Map(
      (await fetchAll(db, "committee_memberships", "committee_id,bioguide_id,side,rank,title,congress"))
        .filter((r) => r.congress === congress).map((r) => [key(r), r])
    );
    const writes = rows.filter((r) => !prev.has(key(r)) || changed(r, prev.get(key(r)), MEMBERSHIP_FIELDS));
    await upsertBatches(db, "committee_memberships", writes, "congress,committee_id,bioguide_id");
    const newKeys = new Set(rows.map(key));
    const removed = [...prev.values()].filter((r) => !newKeys.has(key(r)));
    for (const r of removed) {
      const { error: e } = await db.from("committee_memberships").delete()
        .match({ congress, committee_id: r.committee_id, bioguide_id: r.bioguide_id });
      if (e) throw new Error(`delete membership: ${e.message}`);
    }
    const memInserted = writes.filter((r) => !prev.has(key(r))).length;
    inserted += memInserted;
    updated += writes.length - memInserted;
    return { rows_inserted: inserted, rows_updated: updated, rows_deleted: removed.length };
  });
  console.log(`done: ${counts.rows_inserted} inserted, ${counts.rows_updated} updated, ${counts.rows_deleted} deleted`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
