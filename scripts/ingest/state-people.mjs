// State legislators and statewide officials from openstates/people (public domain, CC0).
// Reads a local clone: OPENSTATES_DIR=/tmp/osp node scripts/ingest/state-people.mjs
// People whose files leave the current data (retired, moved to retired/) are marked inactive.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { getClient, fetchAll, upsertBatches, withRun } from "./lib.mjs";
import { districtKey } from "../../lib/stateleg.js";

// Photos only from the state's or legislature's own site (Chris, Nov 28, 2026). About a fifth of
// Open States photo links point to campaign, caucus, news or image-search sites, and in some chambers
// one party's photos come from its caucus site while the other has none, so coverage differed by
// party. Government hosts (.gov, .us) plus official legislature sites on other domains.
const OFFICIAL_PHOTO_HOSTS = ["senate.mn", "lawmakerdocuments.blob.core.usgovcloudapi.net"];
export function officialPhoto(url) {
  if (!/^https:\/\//.test(url ?? "")) return null;
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  const ok = /\.(gov|us)$/.test(host) || OFFICIAL_PHOTO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  return ok ? url : null;
}
const DIR = join(process.env.OPENSTATES_DIR ?? "/tmp/osp", "data");
const db = getClient();
const iso = (d) => (d == null ? null : d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

await withRun(db, "state-people", async () => {
  const people = [], roles = [];
  for (const st of readdirSync(DIR)) {
    if (st === "us" || !/^[a-z]{2}$/.test(st)) continue;
    for (const sub of ["legislature", "executive"]) {
      const dir = join(DIR, st, sub);
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((n) => n.endsWith(".yml"))) {
        const y = parse(readFileSync(join(dir, file), "utf8"));
        const state = st.toUpperCase();
        const party = (y.party ?? []).find((p) => !p.end_date)?.name ?? y.party?.[0]?.name ?? null;
        people.push({
          id: y.id, state, name: y.name, given_name: y.given_name ?? null, family_name: y.family_name ?? null, party,
          email: y.email ?? null,
          // Photo only from an official government site (see officialPhoto); https only.
          image_url: officialPhoto(y.image),
          offices: (y.offices ?? []).map(({ classification, address, voice, fax }) => ({ classification, address, voice, fax })),
          links: (y.links ?? []).map((l) => l.url).filter(Boolean),
          sources: (y.sources ?? []).map((l) => l.url).filter(Boolean),
          active: true, updated_at: new Date().toISOString(),
        });
        for (const r of y.roles ?? []) {
          if (!r.type) continue;
          const start = iso(r.start_date), end = iso(r.end_date);
          roles.push({
            person_id: y.id, state, type: r.type, district: r.district != null ? String(r.district) : null,
            district_key: districtKey(r.district), start_date: start, end_date: end,
            role_key: `${r.type}|${r.district ?? ""}|${start ?? ""}`,
          });
        }
      }
    }
  }
  const seen = new Set(people.map((p) => p.id));
  const dedupe = (rows, k) => [...new Map(rows.map((r) => [k(r), r])).values()];
  await upsertBatches(db, "state_people", dedupe(people, (p) => p.id), "id");
  await upsertBatches(db, "state_roles", dedupe(roles, (r) => `${r.person_id}|${r.role_key}`), "person_id,role_key");

  // Roles removed from a person's file: delete them so a corrected record doesn't leave a stale role.
  const existing = await fetchAll(db, "state_roles", "person_id,role_key");
  const keep = new Set(roles.map((r) => `${r.person_id}|${r.role_key}`));
  const gone = existing.filter((r) => seen.has(r.person_id) && !keep.has(`${r.person_id}|${r.role_key}`));
  for (const r of gone) await db.from("state_roles").delete().eq("person_id", r.person_id).eq("role_key", r.role_key);

  const before = await fetchAll(db, "state_people", "id,active");
  const left = before.filter((p) => p.active && !seen.has(p.id)).map((p) => p.id);
  for (let i = 0; i < left.length; i += 200) await db.from("state_people").update({ active: false }).in("id", left.slice(i, i + 200));
  console.log(`state people ${people.length}, roles ${roles.length}, roles removed ${gone.length}, now inactive ${left.length}`);
  return { rows_updated: people.length + roles.length };
});
