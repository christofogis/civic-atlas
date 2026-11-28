// The United States Constitution, from the National Archives transcriptions (public domain):
//   https://www.archives.gov/founding-docs/constitution-transcript   (Preamble, Articles I–VII)
//   https://www.archives.gov/founding-docs/bill-of-rights-transcript (Amendments I–X)
//   https://www.archives.gov/founding-docs/amendments-11-27         (Amendments XI–XXVII)
// Pure functions: page HTML -> text lines -> parts (one per section of an article, one per
// amendment), each with the words exactly as transcribed (spelling, capitals and punctuation of the
// original, e.g. "defence", "chuse"). scripts/data/constitution-text.mjs fetches the pages and writes
// data/constitution/us.json; the page (src/pages/Constitution.jsx) reads that file.

export const ARCHIVES = {
  constitution: "https://www.archives.gov/founding-docs/constitution-transcript",
  billOfRights: "https://www.archives.gov/founding-docs/bill-of-rights-transcript",
  amendments: "https://www.archives.gov/founding-docs/amendments-11-27",
};
// The Constitution Annotated (Library of Congress, Congressional Research Service): how courts have
// read each part. Paths as the site uses them: /browse/article-1/section-8/, /browse/amendment-14/.
export const ANNOTATED = "https://constitution.congress.gov/browse";

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV",
  "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII", "XXIV", "XXV", "XXVI", "XXVII"];
export const roman = (n) => ROMAN[n];
const fromRoman = (s) => ROMAN.indexOf(String(s).toUpperCase());

// The same text extraction the probe (scripts/probe/constitution.py) used: block elements become line
// breaks, tags are dropped, entities decoded, spaces collapsed, empty lines removed.
export function textLines(html) {
  let s = String(html ?? "").replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, "");
  s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?(p|div|h[1-6]|li|ul|ol|section|article|tr|table|blockquote)[^>]*>/gi, "\n").replace(/<[^>]+>/g, "");
  s = decode(s).replace(/ /g, " ");
  return s.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
}
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", deg: "°", hellip: "…" };
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return ENT[e.toLowerCase()] ?? m;
  });
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
// "March 4, 1794" or "Sept. 25, 1789" -> "1794-03-04".
export function isoDate(s) {
  const m = String(s ?? "").match(/([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith("sept") ? 4 : 3)];
  return mo ? `${m[3]}-${String(mo).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

const ORD_ES = ["", "Primera", "Segunda", "Tercera", "Cuarta", "Quinta", "Sexta", "Séptima", "Octava", "Novena", "Décima"];
export function headingOf(p) {
  if (p.kind === "preamble") return { en: "Preamble", es: "Preámbulo" };
  if (p.kind === "article") return p.section
    ? { en: `Article ${roman(p.article)}, Section ${p.section}`, es: `Artículo ${roman(p.article)}, Sección ${p.section}` }
    : { en: `Article ${roman(p.article)}`, es: `Artículo ${roman(p.article)}` };
  return { en: `Amendment ${roman(p.amendment)}`, es: `Enmienda ${roman(p.amendment)}${p.amendment <= 10 ? ` (${ORD_ES[p.amendment]} Enmienda)` : ""}` };
}

export function annotatedUrl(p) {
  if (p.kind === "preamble") return `${ANNOTATED}/preamble/`;
  if (p.kind === "article") return `${ANNOTATED}/article-${p.article}/${p.section ? `section-${p.section}/` : ""}`;
  return `${ANNOTATED}/amendment-${p.amendment}/`;
}

export function officialUrl(p) {
  if (p.kind !== "amendment") return ARCHIVES.constitution;
  if (p.amendment <= 10) return ARCHIVES.billOfRights;
  return `${ARCHIVES.amendments}#toc-amendment-${roman(p.amendment).toLowerCase()}`;
}

export const groupOf = (p) => (p.kind === "preamble" ? "preamble" : p.kind === "article" ? "articles" : p.amendment <= 10 ? "bill-of-rights" : "amendments");
export const partId = (p) => (p.kind === "preamble" ? "preamble" : p.kind === "article" ? `art${p.article}${p.section ? `-s${p.section}` : ""}` : `amend${p.amendment}`);

const finish = (p) => ({ id: partId(p), group: groupOf(p), heading: headingOf(p), ...p, sources: { official: officialUrl(p), annotated: annotatedUrl(p) } });

// Constitution transcription: Preamble, then "Article. I." / "Section. 1." markers, one line per clause,
// until the note on words written between the lines of the parchment.
export function parseConstitution(lines) {
  const start = lines.findIndex((l) => l.startsWith("We the People"));
  const end = lines.findIndex((l, i) => i > start && /^The Word, "the," being interlined/.test(l));
  if (start < 0 || end < 0) throw new Error("constitution transcript: start or end not found");
  const parts = [finish({ kind: "preamble", blocks: [{ text: lines[start] }] })];
  let art = 0, cur = null;
  const flush = () => { if (cur) parts.push(finish(cur)); cur = null; };
  for (const l of lines.slice(start + 1, end)) {
    let m;
    if ((m = l.match(/^Article\. ([IVX]+)\.$/))) { flush(); art = fromRoman(m[1]); cur = { kind: "article", article: art, section: null, blocks: [] }; continue; }
    if ((m = l.match(/^Section\. (\d+)\.$/))) {
      if (cur && cur.blocks.length) flush();
      cur = { kind: "article", article: art, section: Number(m[1]), blocks: [] };
      continue;
    }
    if (!cur) throw new Error(`constitution transcript: text before an article: ${l.slice(0, 60)}`);
    cur.blocks.push({ text: l });
  }
  flush();
  // Clause numbers where a section (or an article without sections) has more than one paragraph.
  for (const p of parts) if (p.kind === "article" && p.blocks.length > 1) p.blocks.forEach((b, i) => { b.clause = i + 1; });
  return parts;
}

// Bill of Rights transcription: the ten ratified amendments after "The U.S. Bill of Rights" (the
// Joint Resolution's twelve proposed articles above it are not the amendments as numbered).
export function parseBillOfRights(lines) {
  const start = lines.findIndex((l) => l === "The U.S. Bill of Rights");
  if (start < 0) throw new Error("bill of rights transcript: heading not found");
  // The dates, in the page's own sentences: "On September 25, 1789, the First Congress of the United
  // States proposed 12 amendments..." and "These amendments were ratified December 15, 1791, ...".
  const sentence = (re) => lines.map((l) => l.split(/(?<=\.)\s+(?=[A-Z])/).find((x) => re.test(x))).find(Boolean);
  const proposed = sentence(/^On [A-Z][a-z]+ \d{1,2}, \d{4}, the First Congress/);
  const ratified = sentence(/^These amendments were ratified [A-Z][a-z]+ \d{1,2}, \d{4}/);
  const r = ratified?.match(/ratified ([A-Z][a-z]+ \d{1,2}, \d{4})/)?.[1];
  if (!proposed || !r) throw new Error("bill of rights transcript: dates not found");
  const parts = [];
  let cur = null;
  for (const l of lines.slice(start + 1)) {
    let m;
    if ((m = l.match(/^Amendment ([IVX]+)$/))) {
      if (cur) parts.push(finish(cur));
      const n = fromRoman(m[1]);
      cur = { kind: "amendment", amendment: n, passed: isoDate(proposed), ratified: isoDate(r), dates_text: `${proposed} ${ratified}`, blocks: [] };
      continue;
    }
    if (/^Amendments 11-27$/.test(l) || /^Note:/.test(l)) { if (cur) parts.push(finish(cur)); cur = null; if (parts.length === 10) break; continue; }
    if (cur) cur.blocks.push({ text: l });
  }
  if (parts.length !== 10) throw new Error(`bill of rights transcript: ${parts.length} amendments, not 10`);
  return parts;
}

// Amendments XI–XXVII: heading, the passed/ratified line, optional notes, "Section N." markers,
// paragraphs, and footnotes starting with "*".
export function parseLaterAmendments(lines) {
  const parts = [];
  let cur = null, section = null;
  const stop = lines.findIndex((l) => l === "Back to Constitution Main Page");
  for (const l of lines.slice(0, stop < 0 ? undefined : stop)) {
    let m;
    if ((m = l.match(/^AMENDMENT ([IVX]+)$/))) {
      if (cur) parts.push(finish(cur));
      cur = { kind: "amendment", amendment: fromRoman(m[1]), passed: null, ratified: null, dates_text: null, archives_notes: [], footnotes: [], blocks: [] };
      section = null;
      continue;
    }
    if (!cur) continue;
    if (!cur.dates_text && /Ratified/.test(l)) {
      cur.dates_text = l;
      cur.passed = isoDate(l.match(/(?:Passed by Congress|Originally proposed) ([^.]+\.? ?\d{1,2}, \d{4})/)?.[1]);
      cur.ratified = isoDate(l.match(/Ratified ([A-Z][a-z]+\.? \d{1,2}, \d{4})/)?.[1]);
      const rep = l.match(/Repealed by amendment (\d+)/);
      if (rep) cur.repealed_by = Number(rep[1]);
      continue;
    }
    if (/^Note:/.test(l)) { cur.archives_notes.push(l.replace(/^Note:\s*/, "")); continue; }
    if (/^\*/.test(l)) { cur.footnotes.push(l); continue; }
    if ((m = l.match(/^Section (\d+)\.$/))) { section = Number(m[1]); continue; }
    cur.blocks.push(section ? { section, text: l } : { text: l });
  }
  if (cur) parts.push(finish(cur));
  for (const p of parts) { if (!p.archives_notes.length) delete p.archives_notes; if (!p.footnotes.length) delete p.footnotes; }
  if (parts.length !== 17) throw new Error(`amendments 11-27 transcript: ${parts.length} amendments, not 17`);
  return parts;
}

// Passages of the original text that later amendments changed, as the National Archives marks them:
// the hyperlinked text in the Constitution transcription (each link points to the amendment), and
// the notes and footnotes on the Amendments 11–27 page. `passage` is the marked text, exactly.
// Factual cross-references only; how far each change reaches is for the Constitution Annotated.
export const CHANGES = [
  { part: "art1-s2", clause: 3, passage: "Representatives and direct Taxes shall be apportioned among the several States which may be included within this Union, according to their respective Numbers, which shall be determined by adding to the whole Number of free Persons, including those bound to Service for a Term of Years, and excluding Indians not taxed, three fifths of all other Persons.", by: { amendment: 14, section: 2 }, verb: "modified" },
  { part: "art1-s3", clause: 1, passage: "chosen by the Legislature", by: { amendment: 17 }, verb: "modified" },
  { part: "art1-s3", clause: 2, passage: "and if Vacancies happen by Resignation, or otherwise, during the Recess of the Legislature of any State, the Executive thereof may make temporary Appointments until the next Meeting of the Legislature, which shall then fill such Vacancies.", by: { amendment: 17 }, verb: "modified" },
  { part: "art1-s4", clause: 2, passage: "the first Monday in December", by: { amendment: 20, section: 2 }, verb: "modified" },
  { part: "art1-s9", clause: 4, passage: "unless in Proportion to the Census or enumeration herein before directed to be taken.", by: { amendment: 16 }, verb: "modified" },
  { part: "art2-s1", clause: 3, passage: "The Electors shall meet in their respective States, and vote by Ballot for two Persons,", by: { amendment: 12 }, verb: "superseded", whole: true },
  { part: "art2-s1", clause: 6, passage: "In Case of the Removal of the President from Office,", by: { amendment: 25 }, verb: "affected", whole: true },
  { part: "art3-s2", clause: 1, passage: "between a State and Citizens of another State", by: { amendment: 11 }, verb: "modified" },
  { part: "art4-s2", clause: 3, passage: "No Person held to Service or Labour in one State,", by: { amendment: 13 }, verb: "superseded", whole: true },
  { part: "amend12", passage: "[And if the House of Representatives shall not choose a President whenever the right of choice shall devolve upon them, before the fourth day of March next following, then the Vice-President shall act as President, as in the case of the death or other constitutional disability of the President. --]*", by: { amendment: 20, section: 3 }, verb: "superseded" },
  { part: "amend14", section: 2, passage: "being twenty-one years of age,*", by: { amendment: 26, section: 1 }, verb: "changed" },
  { part: "amend18", by: { amendment: 21, section: 1 }, verb: "repealed", whole: true },
];

// One sentence per change, in both languages. No reading of what the change means.
const VERBS = {
  modified: ["was modified by", "modificada", "modificadas"], superseded: ["was superseded by", "reemplazada", "reemplazadas"],
  affected: ["was affected by", "afectada", "afectadas"], changed: ["was changed by", "cambiada", "cambiadas"], repealed: ["was repealed by", "derogada"],
};
export function changeNote(c) {
  const sec = (w) => (c.by.section ? `, ${w} ${c.by.section}` : "");
  const en = `Amendment ${roman(c.by.amendment)}${sec("Section")}`, es = `la Enmienda ${roman(c.by.amendment)}${sec("Sección")}`;
  const [ven, one, many] = VERBS[c.verb];
  if (c.verb === "repealed") return { en: `This amendment ${ven} ${en}.`, es: `Esta enmienda fue ${one} por ${es}.` };
  return c.whole
    ? { en: `This clause ${ven} ${en}, as the National Archives notes.`, es: `Esta cláusula fue ${one} por ${es}, según los Archivos Nacionales.` }
    : { en: `The marked words ${ven.replace("was", "were")} ${en}, as the National Archives notes.`, es: `Las palabras marcadas fueron ${many} por ${es}, según los Archivos Nacionales.` };
}

// Attach CHANGES to the parsed parts (each block gets `changes`, the part gets `changed_by` notes for
// amendments that alter it) and cross-link the amending part (`changes_parts`). Throws if a passage
// isn't found verbatim, so a change in the transcription is caught at build time.
export function applyChanges(parts) {
  const byId = new Map(parts.map((p) => [p.id, p]));
  for (const c of CHANGES) {
    const p = byId.get(c.part);
    if (!p) throw new Error(`change: no part ${c.part}`);
    const note = changeNote(c);
    const target = `amend${c.by.amendment}`;
    if (c.passage) {
      const blocks = p.blocks.filter((b) => (c.clause ? b.clause === c.clause : true) && (c.section ? b.section === c.section : true));
      const b = blocks.find((x) => x.text.includes(c.passage));
      if (!b) throw new Error(`change: passage not found in ${c.part}${c.clause ? ` clause ${c.clause}` : ""}: ${c.passage.slice(0, 50)}`);
      (b.changes ??= []).push({ passage: c.whole ? null : c.passage, by: target, by_section: c.by.section ?? null, verb: c.verb, note });
    } else {
      (p.changes ??= []).push({ by: target, by_section: c.by.section ?? null, verb: c.verb, note });
    }
    const t = byId.get(target);
    if (t) (t.changes_parts ??= []).includes(c.part) || t.changes_parts.push(c.part);
  }
  return parts;
}

export function buildParts({ constitution, billOfRights, amendments }) {
  const parts = [...parseConstitution(constitution), ...parseBillOfRights(billOfRights), ...parseLaterAmendments(amendments)];
  return applyChanges(parts);
}

// All the words of a part, as one text (for the summarizer and for search).
export function partText(p) {
  return p.blocks.map((b) => `${b.clause ? `Clause ${b.clause}. ` : ""}${b.section ? `Section ${b.section}. ` : ""}${b.text}`).join("\n");
}

// Search within the page: every word of the query appears in the heading, the original text or the
// shown summaries (accents and case ignored).
const fold = (s) => String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export function matchesQuery(p, q, lang = "en") {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const shown = (s) => (s?.status === "passed" ? `${s.en} ${s.es}` : "");
  const hay = fold([p.heading.en, p.heading.es, p.blocks.map((b) => b.text).join(" "), shown(p.summary), shown(p.simple),
    lang === "es" ? `enmienda ${p.amendment ?? ""} articulo ${p.article ?? ""} seccion ${p.section ?? ""}` : `amendment ${p.amendment ?? ""} article ${p.article ?? ""} section ${p.section ?? ""}`].join(" "));
  return words.every((w) => hay.includes(w));
}

// The AI text the page may show for a part and level ("summary" or "simple"): only one that passed its
// check and was written from the text as stored. Otherwise null, and the page shows the text alone.
export function shownSummary(part, level = "summary") {
  const s = part?.[level];
  if (!s || s.status !== "passed" || !s.en || !s.es) return null;
  if (part.text_hash && s.text_hash !== part.text_hash) return null;
  return { en: s.en, es: s.es };
}

// What the site serves (vite.config.js builds it to /data/constitution/us.json): the text and links,
// and only the AI summaries that may be shown; no check notes, held drafts or batch state.
export function publicData(data) {
  return {
    title: data.title, source: data.source, sources: data.sources, retrieved: data.retrieved,
    parts: data.parts.map(({ summary, simple, text_hash, ...p }) => {
      const out = { ...p };
      const s = shownSummary({ summary, text_hash }), e = shownSummary({ simple, text_hash }, "simple");
      if (s) out.summary = s;
      if (s && e) out.simple = e;   // the simple version is offered only beside a shown summary
      return out;
    }),
  };
}
