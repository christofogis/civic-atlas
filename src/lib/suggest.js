// Pure helpers for the header search suggestions: reading a bill number out of what was typed,
// matching names and titles by word prefix, building a prefix text-search query, choosing which
// rows to show, and marking the typed part for bold. No database here, so Node tests can import it.

// Lowercase without accents, so "sanchez" finds "Sánchez" and "nunez" finds "Núñez".
export const fold = (s) => String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// Words of a text, folded. Hyphenated and apostrophe names also count as one joined word, so
// "ocasio", "cortez", "ocasiocortez" and "orourke" all match.
export function wordsOf(text) {
  const out = new Set();
  for (const chunk of fold(text).split(/\s+/)) {
    const parts = chunk.match(/[\p{L}\p{N}]+/gu) ?? [];
    for (const p of parts) out.add(p);
    if (parts.length > 1) out.add(parts.join(""));
  }
  return [...out];
}

// The words someone typed, folded, in order.
export const queryWords = (q) => fold(q).match(/[\p{L}\p{N}]+/gu) ?? [];

// Every typed word starts some word of the text.
export function prefixMatch(textWords, qWords) {
  return qWords.length > 0 && qWords.every((w) => textWords.some((tw) => tw.startsWith(w)));
}

// ---- Bill numbers -----------------------------------------------------------------------------
// The whole box read as one bill number: "H.R. 1", "hr1", "S 5", "s.5", "H.Res. 757", "hjres 12".
// Lowercase "s 5" counts here (unlike in running text, where extractBillRefs wants a capital S),
// because nothing else is in the box.
const BILL_RE = /^\s*(h\.?\s?con\.?\s?res|s\.?\s?con\.?\s?res|h\.?\s?j\.?\s?res|s\.?\s?j\.?\s?res|h\.?\s?res|s\.?\s?res|h\.?\s?r|s)\.?\s*(\d{1,5})\s*$/i;

export function parseBillQuery(q) {
  const m = BILL_RE.exec(String(q ?? ""));
  if (!m) return null;
  const number = parseInt(m[2], 10);
  if (!number) return null;
  return { bill_type: m[1].toLowerCase().replace(/[^a-z]/g, ""), number, digits: String(number) };
}

// Bill numbers that start with the typed digits and are longer: 15 -> 150–159, 1500–1599, 15000–15999.
// Ranges keep the lookup on the bills primary key (congress, bill_type, number).
export function numberPrefixRanges(n, maxDigits = 5) {
  const len = String(n).length;
  const out = [];
  for (let k = 1; len + k <= maxDigits; k++) out.push([n * 10 ** k, (n + 1) * 10 ** k - 1]);
  return out;
}

// The same ranges as a PostgREST or=() filter body.
export const rangesFilter = (ranges) => ranges.map(([a, b]) => `and(number.gte.${a},number.lte.${b})`).join(",");

// Congresses we hold bills for, newest first: the 118th (2023) to the one in session.
export function congressesSince118(current) {
  const out = [];
  for (let c = current; c >= 118; c--) out.push(c);
  return out;
}

// ---- Title words --------------------------------------------------------------------------------
// "Bill", "act" and "resolution" match almost every title (and "act:*" alone makes the database
// read every bill), so they are dropped, as on the search page.
const FILLER = new Set(["bill", "bills", "act", "acts", "resolution", "resolutions"]);

// A to_tsquery string for words typed so far: all words must appear, the last one may be
// unfinished ("farm secu" -> "farm & secu:*"). Only letters and digits get through, so no
// tsquery operator typed by a visitor can reach the database. The last word gets :* only from
// 4 letters, since short prefixes match thousands of titles; a 3-letter word is taken whole ("tax"). `trim` shortens an unfinished last
// word, used for a second try: the English stemmer turns "securi:*" into "securi", which misses
// the stored "secur".
export function prefixTsquery(q, { trim = 0 } = {}) {
  const words = (String(q ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => !FILLER.has(w));
  if (!words.length || words.join("").length < 3) return null;
  let last = words.pop();
  const head = words.filter((w) => w.length > 1);
  const parts = [...head];
  if (last.length >= 4) {
    if (trim) last = last.slice(0, Math.max(4, last.length - trim));
    parts.push(`${last}:*`);
  } else if (last.length === 3) {
    parts.push(last);
  } // a one- or two-letter unfinished word is left out until it grows
  return parts.length ? parts.join(" & ") : null;
}

// ---- Matching our own lists ----------------------------------------------------------------------

// Members from the directory: every typed word starts a word of the name, last name or nickname.
// Serving members first, then former; within each, last-name hits, then whole-word hits, then A–Z.
export function matchMembers(directory, q, limit = 8) {
  const qw = queryWords(q);
  if (!qw.length || qw.join("").length < 2) return [];
  const out = [];
  for (const m of directory ?? []) {
    const words = wordsOf(`${m.name ?? ""} ${m.last_name ?? ""} ${m.nickname ?? ""}`);
    if (!prefixMatch(words, qw)) continue;
    const last = wordsOf(m.last_name);
    const lastHit = qw.some((w) => last.some((lw) => lw.startsWith(w))) ? 1 : 0;
    const whole = qw.filter((w) => words.includes(w)).length;
    out.push({ m, rank: [m.serving ? 1 : 0, lastHit, whole] });
  }
  out.sort((a, b) => b.rank[0] - a.rank[0] || b.rank[1] - a.rank[1] || b.rank[2] - a.rank[2]
    || fold(a.m.last_name).localeCompare(fold(b.m.last_name)) || fold(a.m.name).localeCompare(fold(b.m.name)));
  return out.slice(0, limit).map((x) => x.m);
}

// Committees, topics and site pages: every typed word starts a word of the label. Labels whose
// first word matches come first, then shorter labels.
export function matchByWords(items, q, label, limit = 3) {
  const qw = queryWords(q);
  if (!qw.length || qw.join("").length < 2) return [];
  const seen = new Set();
  const out = [];
  for (const it of items ?? []) {
    const text = label(it);
    if (!text || seen.has(text)) continue;
    const words = wordsOf(text);
    if (!prefixMatch(words, qw)) continue;
    seen.add(text);
    out.push({ it, first: words[0]?.startsWith(qw[0]) ? 1 : 0, len: text.length });
  }
  out.sort((a, b) => b.first - a.first || a.len - b.len);
  return out.slice(0, limit).map((x) => x.it);
}

// ---- Choosing rows ----------------------------------------------------------------------------------
// Groups in display order; rows are taken one per group in turn until `max`, so every group with a
// match shows at least one row and none crowds the rest out.
export function pickRows(groups, max = 8) {
  const taken = groups.map(() => 0);
  let total = 0;
  for (let progress = true; progress && total < max;) {
    progress = false;
    for (let i = 0; i < groups.length && total < max; i++) {
      if (taken[i] < groups[i].items.length) { taken[i]++; total++; progress = true; }
    }
  }
  return groups.map((g, i) => ({ ...g, items: g.items.slice(0, taken[i]) })).filter((g) => g.items.length);
}

// ---- Bold for the typed part ------------------------------------------------------------------------
// Split text into [{ text, match }] where the start of each word that a typed word begins is a
// match. Accent-insensitive; the original spelling is kept.
export function highlightParts(text, q) {
  const s = String(text ?? "");
  const qw = [...new Set(queryWords(q))].sort((a, b) => b.length - a.length);
  if (!qw.length) return [{ text: s, match: false }];
  const parts = [];
  let at = 0;
  for (const m of s.matchAll(/[\p{L}\p{M}\p{N}]+/gu)) {
    const fw = fold(m[0]);
    const tok = qw.find((w) => fw.startsWith(w));
    if (!tok) continue;
    const chars = Array.from(m[0]);
    let n = 0, got = 0;
    while (got < tok.length && n < chars.length) { got += fold(chars[n]).length; n++; }
    while (n < chars.length && /\p{M}/u.test(chars[n])) n++;
    const len = chars.slice(0, n).join("").length;
    if (m.index > at) parts.push({ text: s.slice(at, m.index), match: false });
    parts.push({ text: s.slice(m.index, m.index + len), match: true });
    at = m.index + len;
  }
  if (at < s.length) parts.push({ text: s.slice(at), match: false });
  return parts.length ? parts : [{ text: s, match: false }];
}

// Bills found by title words, best match first: a short title whose first words are exactly what's
// typed, then one that starts with it, then
// one where every typed word starts a word of the short title, then the rest; most recent action
// first within each. "farm" puts the Farm, Food, and National Security Act above newer bills that
// only mention farmers in a long official title.
export function rankBills(bills, q, limit = 5) {
  const qw = wordsOf(q).filter((w) => !/^(bills?|acts?|resolutions?)$/.test(w));
  const score = (b) => {
    const st = wordsOf(b.short_title ?? "");
    if (!qw.length || !st.length) return 0;
    if (qw.every((w, i) => st[i] === w)) return 3;
    if (qw.every((w, i) => st[i]?.startsWith(w))) return 2;
    return prefixMatch(st, qw) ? 1 : 0;
  };
  return bills
    .map((b, i) => ({ b, s: score(b), i }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .slice(0, limit)
    .map((x) => x.b);
}
