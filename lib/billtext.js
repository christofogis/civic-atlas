// Bill text versions: which versions exist (from BILLSTATUS), and a section-by-section comparison
// of two versions' official XML (GPO bill DTD). Used by scripts/ingest/bill-text.mjs.
//
// The comparison is mechanical and says only what changed, never why or with what effect:
// sections are matched by their heading (and the headings of the titles they sit in), so a
// renamed section shows as one removed and one added, and renumbering alone is not a change.
import { DOMParser } from "@xmldom/xmldom";

const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// "BILLS-119hr1eh" -> "eh"; "PLAW-119publ21" -> "law".
export function versionCode(url) {
  const m = String(url ?? "").match(/\/(BILLS-\d+[a-z]+\d+([a-z]+)|PLAW-\d+(?:publ|pvtl)\d+)\//);
  if (!m) return null;
  return m[2] ?? "law";
}

// BILLSTATUS <textVersions> items -> rows, oldest first. The enrolled version has no date in
// BILLSTATUS; it comes after every dated bill version and before the public law.
export function textVersions(items, { congress, bill_type, number, presented_date }) {
  const rows = [];
  for (const it of list(items)) {
    const formats = list(it.formats?.item);
    const xml = formats.map((f) => String(f.url ?? "")).find((u) => /\/xml\/BILLS-|\/uslm\/PLAW-/.test(u));
    const code = versionCode(xml);
    if (!code || rows.some((r) => r.version_code === code)) continue;
    rows.push({
      congress, bill_type, number,
      version_code: code,
      version_name: String(it.type ?? "").trim() || code,
      version_date: it.date ? String(it.date).slice(0, 10) : (code === "enr" ? presented_date ?? null : null),
      xml_url: xml,
    });
  }
  const rank = (r) => (r.version_code === "law" ? 2 : r.version_code === "enr" ? 1 : 0);
  rows.sort((a, z) => rank(a) - rank(z) || String(a.version_date ?? "").localeCompare(String(z.version_date ?? "")));
  rows.forEach((r, i) => (r.seq = i + 1));
  return rows;
}

const ELEMENT = 1;
const kids = (n) => Array.from(n.childNodes ?? []).filter((c) => c.nodeType === ELEMENT);
const child = (n, name) => kids(n).find((c) => c.nodeName === name);
const deleted = (n) => n.nodeName === "deleted-phrase" || n.getAttribute?.("changed") === "deleted";

// Text of a node, leaving out text marked as deleted (reported versions show struck text).
function textOf(n, skip = () => false) {
  if (n.nodeType === 3 || n.nodeType === 4) return n.nodeValue;
  if (n.nodeType !== ELEMENT || deleted(n) || skip(n)) return "";
  return Array.from(n.childNodes).map((c) => textOf(c, skip)).join(" ");
}
const norm = (s) => s.replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
  .replace(/\s+/g, " ").replace(/\s([,.;:)])/g, "$1").replace(/\(\s/g, "(").trim();
const words = (s) => (s ? s.split(" ").length : 0);
const CONTAINERS = new Set(["division", "title", "subtitle", "part", "subpart", "chapter", "subchapter"]);
const BODIES = ["legis-body", "resolution-body"];

// Sections of a bill version: [{ key, path, header, text, words }]. Returns null for documents
// that are not a full bill text (an engrossed amendment lists only the changes).
export function sectionsFromXml(xml) {
  const doc = new DOMParser({ onError: () => {} }).parseFromString(xml, "text/xml");
  // Senate reported versions have two bodies: the struck original, then the committee's text.
  const bodies = BODIES.flatMap((b) => Array.from(doc.getElementsByTagName(b)))
    .filter((n) => { for (let p = n.parentNode; p; p = p.parentNode) if (BODIES.includes(p.nodeName)) return false; return true; });
  if (!bodies.length) return null;
  const out = [];
  const seen = new Map();
  const walk = (n, path) => {
    for (const c of kids(n)) {
      if (deleted(c) || c.nodeName === "quoted-block") continue;
      if (CONTAINERS.has(c.nodeName)) {
        const h = norm(textOf(child(c, "header") ?? { nodeType: 0 }));
        walk(c, h ? [...path, h] : path);
      } else if (c.nodeName === "section") {
        const header = norm(textOf(child(c, "header") ?? { nodeType: 0 })) || "(untitled section)";
        // The section's own number is left out: renumbering alone is not a change.
        const ownEnum = child(c, "enum");
        const text = norm(textOf(c, (x) => x === ownEnum));
        let key = [...path, header].join(" > ").toLowerCase();
        const k = (seen.get(key) ?? 0) + 1;
        seen.set(key, k);
        if (k > 1) key += ` #${k}`;
        out.push({ key, path, header, text, words: words(text) });
      } else {
        walk(c, path);
      }
    }
  };
  for (const body of bodies) if (!deleted(body)) walk(body, []);
  if (!out.length) {
    const text = norm(bodies.map((b) => textOf(b)).join(" "));
    if (text) out.push({ key: "(full text)", path: [], header: "Full text", text, words: words(text) });
  }
  return out;
}

const MAX_LISTED = 400;
const brief = (s) => ({ path: s.path, header: s.header });

// Compare two versions' sections. Lists are capped; counts are always complete.
export function compareSections(a, b) {
  // Match by heading within its titles first. Then, for what's left, by heading alone when it is
  // unique on both sides: a chamber often renames the titles (House and Senate committee names)
  // without touching the sections inside them.
  const match = new Map();   // b section -> a section
  const A = new Map(a.map((s) => [s.key, s]));
  for (const s of b) if (A.has(s.key)) match.set(s, A.get(s.key));
  const used = new Set(match.values());
  const restA = a.filter((s) => !used.has(s)), restB = b.filter((s) => !match.has(s));
  const byHeader = (rows) => rows.reduce((m, s) => m.set(s.header.toLowerCase(), [...(m.get(s.header.toLowerCase()) ?? []), s]), new Map());
  const hA = byHeader(restA), hB = byHeader(restB);
  for (const [h, bs] of hB) if (bs.length === 1 && hA.get(h)?.length === 1) { match.set(bs[0], hA.get(h)[0]); used.add(hA.get(h)[0]); }
  const added = b.filter((s) => !match.has(s));
  const removed = a.filter((s) => !used.has(s));
  const changed = b.filter((s) => match.has(s) && match.get(s).text !== s.text)
    .map((s) => ({ ...brief(s), words_from: match.get(s).words, words_to: s.words }));
  return {
    sections_from: a.length, sections_to: b.length,
    words_from: a.reduce((n, s) => n + s.words, 0), words_to: b.reduce((n, s) => n + s.words, 0),
    added_count: added.length, removed_count: removed.length, changed_count: changed.length,
    unchanged_count: b.length - added.length - changed.length,
    added: added.slice(0, MAX_LISTED).map(brief),
    removed: removed.slice(0, MAX_LISTED).map(brief),
    changed: changed.slice(0, MAX_LISTED),
  };
}
