// Finds glossary terms in a block of text (an AI summary, a CRS summary, a vote question) so each can
// be shown as a small button that opens its definition. The words themselves are never changed:
// the text is only cut into pieces, and joining the pieces gives the text back exactly.
import { GLOSSARY } from "./glossary.js";

// Whole words only. \b doesn't know accented letters, so letters and digits are spelled out.
const EDGE = "\\p{L}\\p{N}";
const compile = (alts) => new RegExp(`(?<![${EDGE}])(?:${alts.join("|")})(?![${EDGE}])`, "giu");

const PATTERNS = { en: [], es: [] };
for (const [id, g] of Object.entries(GLOSSARY)) {
  if (g.match?.length) PATTERNS.en.push({ id, re: compile(g.match) });
  if (g.match_es?.length) PATTERNS.es.push({ id, re: compile(g.match_es) });
}

// Every glossary term in the text: [{start, end, id}], left to right. Where two terms overlap, the
// one that starts first wins, then the longer ("continuing appropriations" over "appropriations").
export function findTerms(text, lang = "en") {
  const s = String(text ?? "");
  if (!s) return [];
  const all = [];
  for (const { id, re } of PATTERNS[lang] ?? PATTERNS.en) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(s));) {
      if (!m[0]) { re.lastIndex++; continue; }
      all.push({ start: m.index, end: m.index + m[0].length, id });
    }
  }
  all.sort((a, z) => a.start - z.start || (z.end - z.start) - (a.end - a.start));
  const out = [];
  let upTo = 0;
  for (const t of all) if (t.start >= upTo) { out.push(t); upTo = t.end; }
  return out;
}

// The text cut into pieces: {text} for plain words and {text, id} for a term to mark. Only the first
// occurrence of each term is marked; `seen` carries the terms already marked earlier in the same
// block (a lead and its points), and is updated.
export function markTerms(text, { lang = "en", seen = new Set() } = {}) {
  const s = String(text ?? "");
  const parts = [];
  let at = 0;
  for (const t of findTerms(s, lang)) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    if (t.start > at) parts.push({ text: s.slice(at, t.start) });
    parts.push({ text: s.slice(t.start, t.end), id: t.id });
    at = t.end;
  }
  if (at < s.length || !parts.length) parts.push({ text: s.slice(at) });
  return parts;
}

// Several texts that read as one block (a lead and its points): one marked term per block.
export function markBlock(texts, lang = "en") {
  const seen = new Set();
  return texts.map((t) => markTerms(t, { lang, seen }));
}
