// The Constitution's text for /constitution: fetches the three National Archives transcriptions,
// splits them into parts (lib/constitution.js) and writes data/constitution/us.json. The text never
// changes, so this runs by hand; re-running it keeps every stored AI summary whose part text is
// unchanged and drops (with a message) any whose text changed, so it is written again.
//
//   node scripts/data/constitution-text.mjs                 (fetch from archives.gov)
//   node scripts/data/constitution-text.mjs --from <dir>    (read saved pages: constitution, bill-of-rights,
//                                                            amendments as .html, or .txt text lines)
//   node scripts/data/constitution-text.mjs --check         (compare only; fail if the text differs)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { ARCHIVES, textLines, buildParts, partText } from "../../lib/constitution.js";

export const FILE = "data/constitution/us.json";
const UA = { headers: { "User-Agent": "civic-atlas constitution build (github.com/christofogis/civic-atlas)" } };
const args = process.argv.slice(2);
const FROM = args.includes("--from") ? args[args.indexOf("--from") + 1] : null;
const CHECK = args.includes("--check");

export const textHash = (p) => createHash("sha256").update(partText(p)).digest("hex").slice(0, 16);

async function lines(name, url) {
  if (FROM) {
    const txt = `${FROM}/${name}.txt`, html = `${FROM}/${name}.html`;
    if (existsSync(txt)) return readFileSync(txt, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
    return textLines(readFileSync(html, "utf8"));
  }
  const res = await fetch(url, UA);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return textLines(await res.text());
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const parts = buildParts({
    constitution: await lines("constitution", ARCHIVES.constitution),
    billOfRights: await lines("bill-of-rights", ARCHIVES.billOfRights),
    amendments: await lines("amendments", ARCHIVES.amendments),
  });
  const old = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { parts: [] };
  const oldById = new Map(old.parts.map((p) => [p.id, p]));
  let changed = 0;
  for (const p of parts) {
    p.text_hash = textHash(p);
    const o = oldById.get(p.id);
    if (o && o.text_hash !== p.text_hash) { changed++; console.log(`${p.id}: text differs from the stored copy`); }
    // Summaries carry the hash of the text they were written from; keep them only for the same text.
    for (const k of ["summary", "simple"]) if (o?.[k] && o[k].text_hash === p.text_hash) p[k] = o[k];
  }
  if (CHECK) {
    if (changed || parts.length !== old.parts.length) { console.log(`${changed} parts differ; ${parts.length} parts vs ${old.parts.length} stored`); process.exit(1); }
    console.log(`${parts.length} parts; text matches the stored copy`);
  } else {
    const out = {
      title: "The Constitution of the United States",
      source: "National Archives transcriptions (public domain). Spelling, capitalization and punctuation as transcribed.",
      sources: ARCHIVES,
      retrieved: old.retrieved && !changed && old.parts.length === parts.length ? old.retrieved : new Date().toISOString().slice(0, 10),
      batches: old.batches ?? [],
      parts,
    };
    mkdirSync("data/constitution", { recursive: true });
    writeFileSync(FILE, JSON.stringify(out, null, 1) + "\n");
    console.log(`wrote ${FILE}: ${parts.length} parts${changed ? `, ${changed} with changed text` : ""}`);
  }
}
