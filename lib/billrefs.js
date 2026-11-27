// Find federal bill numbers in free text, such as the "specific lobbying issues" a lobbyist
// writes on an LD-2 report: "H.R. 4791/S. 1462, the Fix Our Forests Act", "HR973/S389".
// Returns unique {bill_type, number} pairs. The caller decides the Congress (from the filing
// year) and keeps only bills that exist, which screens out most stray matches.

// Longest prefixes first so "H.J.Res." is not read as "H." + ...
const PREFIXES = [
  ["hconres", String.raw`H\.?\s?Con\.?\s?Res`],
  ["sconres", String.raw`S\.?\s?Con\.?\s?Res`],
  ["hjres", String.raw`H\.?\s?J\.?\s?Res`],
  ["sjres", String.raw`S\.?\s?J\.?\s?Res`],
  ["hres", String.raw`H\.?\s?Res`],
  ["sres", String.raw`S\.?\s?Res`],
  ["hr", String.raw`H\.?\s?R`],
  ["s", String.raw`S`],
];

// Not preceded by a letter, digit or period ("U.S. 1", "FY2026", "Sec. 5" don't match), and
// the number is not followed by more digits, letters or a decimal ("S. 1462a", "H.R. 2.5").
const PATTERN = new RegExp(
  String.raw`(?<![A-Za-z0-9.])(?:` + PREFIXES.map(([, p]) => `(${p})`).join("|") +
    String.raw`)\.?\s{0,2}(\d{1,2},\d{3}|\d{1,5})(?![\d,]*\d)(?![A-Za-z]|\.\d)`,
  "gi",
);

export function extractBillRefs(text) {
  const found = new Map();
  for (const m of String(text ?? "").matchAll(PATTERN)) {
    const i = m.slice(1, PREFIXES.length + 1).findIndex((g) => g !== undefined);
    const raw = m[0].slice(0, m[0].length - m[PREFIXES.length + 1].length);
    // A bare "S" must be written in capitals ("S 811", "S.94"), not "s 5" inside a sentence.
    if (PREFIXES[i][0] === "s" && !/^S/.test(raw)) continue;
    const number = parseInt(m[PREFIXES.length + 1].replace(",", ""), 10);
    if (!number) continue;
    const ref = { bill_type: PREFIXES[i][0], number };
    found.set(`${ref.bill_type}${number}`, ref);
  }
  return [...found.values()];
}

// LD-2 reports cover a calendar quarter; Congresses start in odd years (2025 -> 119th).
export function congressForYear(year) {
  return Math.floor((year - 1789) / 2) + 1;
}

// Split free text into plain pieces and bill references, in order, so a page can link each bill
// number where it appears ("Referred to H.R. 1234" -> "Referred to " + link). Same matching rules
// as extractBillRefs.
export function splitBillRefs(text) {
  const s = String(text ?? "");
  const out = [];
  let at = 0;
  for (const m of s.matchAll(PATTERN)) {
    const i = m.slice(1, PREFIXES.length + 1).findIndex((g) => g !== undefined);
    const raw = m[0].slice(0, m[0].length - m[PREFIXES.length + 1].length);
    if (PREFIXES[i][0] === "s" && !/^S/.test(raw)) continue;
    const number = parseInt(m[PREFIXES.length + 1].replace(",", ""), 10);
    if (!number) continue;
    if (m.index > at) out.push({ text: s.slice(at, m.index) });
    out.push({ text: m[0], bill_type: PREFIXES[i][0], number });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ text: s.slice(at) });
  return out;
}

// ---- Titles written next to bill numbers ----------------------------------------------------
// Lobbying reports often name a bill as well as numbering it: "Equality Act (H.R. 5 / S. 393)",
// "S. 2224, Stop Predatory Investing Act". The number is matched to the Congress in session in the
// report's year, so a number carried over from an earlier Congress would otherwise link to an
// unrelated bill. billRefTitles finds such a name when one is written right next to the number;
// titleMatches compares it with a bill's titles. No name found -> null (the number alone decides).

// Short words allowed inside a title ("Fix Our Forests Act", "Protecting Americans from ... Act").
const SMALL = new Set(["of", "the", "for", "and", "to", "in", "on", "a", "an", "from", "with", "by", "at", "or", "our", "against", "act"]);
const isTitleWord = (w) => /^[A-Z0-9"“'‘(]/.test(w) || SMALL.has(w.toLowerCase().replace(/[^a-z]/g, ""));
// A name ends in "Act" or "Resolution", optionally "of 2025" (as in "the SAFE Banking Act of 2025").
const TITLE_END = String.raw`\b(?:Act|ACT|Resolution|RESOLUTION)(?:\s+(?:of|OF)\s+\d{4})?`;

// Words of `phrase` read backward from its end while they look like title words; leading short
// words ("the", "on the") are dropped. Returns null unless the phrase ends with a title ending.
function trailingTitle(phrase) {
  const m = new RegExp(`(${TITLE_END})\\s*$`).exec(phrase);
  if (!m) return null;
  const words = phrase.slice(0, m.index).trim().split(/\s+/).filter(Boolean);
  const kept = [];
  for (let i = words.length - 1; i >= 0 && kept.length < 20 && isTitleWord(words[i]); i--) kept.unshift(words[i]);
  while (kept.length && SMALL.has(kept[0].toLowerCase())) kept.shift();
  return kept.length ? `${kept.join(" ")} ${m[1]}` : null;
}

// The name written right after a number: ", the Fix Our Forests Act", " - Stop Predatory Investing
// Act", " (Equality Act)". Every word up to the ending must look like a title word, so "S. 3, a bill
// to amend the Public Health Service Act" has no name.
function leadingTitle(rest) {
  const m = /^\s*(?:[,:(]|[-–—]{1,2})\s*(?:the\s+)?/i.exec(rest);
  if (!m) return null;
  const chunk = rest.slice(m[0].length).split(/[;()\n]|,\s|\s[-–—]\s/)[0].slice(0, 200);
  const end = new RegExp(TITLE_END).exec(chunk);
  if (!end) return null;
  const words = chunk.slice(0, end.index).trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 20 || !words.every(isTitleWord)) return null;
  return `${words.join(" ")} ${end[0]}`;
}

// Map "hr5" -> name written next to it (or null). Numbers joined only by "/", ",", "&", "and" or
// "or" form one group ("H.R. 4791/S. 1462, the Fix Our Forests Act") and share the name.
export function billRefTitles(text) {
  const parts = splitBillRefs(text);
  const out = new Map();
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i].bill_type) continue;
    const group = [parts[i]];
    let tail = 0; // where the run of numbers joined without a comma ends the group
    let j = i + 1;
    while (j + 1 < parts.length && parts[j + 1].bill_type && /^[\s/,&]*(?:\b(?:and|or)\b)?[\s/,&]*$/i.test(parts[j].text)) {
      if (parts[j].text.includes(",")) tail = group.length;
      group.push(parts[j + 1]);
      j += 2;
    }
    const before = i > 0 ? parts[i - 1].text : "";
    const after = j < parts.length && !parts[j].bill_type ? parts[j].text : "";
    let title = null;
    let named = group;
    if (/\(\s*$/.test(before)) {
      // "Equality Act (H.R. 5 / S. 393)": the name comes before the opening parenthesis and
      // covers every number inside it.
      const lead = before.replace(/\(\s*$/, "").split(/[;:\n]|,\s|\s[-–—]\s/).at(-1);
      title = trailingTitle(lead.trim());
    } else {
      // A name after the numbers covers companion numbers joined by "/" or "and", but in a
      // comma list ("H.R. 2, H.R. 3, the Foo Act") only the last of them.
      title = leadingTitle(after);
      named = group.slice(tail);
    }
    for (const r of group) {
      const k = `${r.bill_type}${r.number}`;
      const t = named.includes(r) ? title : null;
      if (!out.has(k) || (out.get(k) == null && t)) out.set(k, t);
    }
    i = j - 1;
  }
  return out;
}

const STOP = new Set([...SMALL, "act", "resolution", "bill"]);
const normTitle = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "").replace(/\bof\s+\d{4}\b/g, " ")
  .replace(/[^a-z0-9]+/g, " ").replace(/\b(the)\b/g, " ").replace(/\s+/g, " ").trim();
const tokens = (s) => normTitle(s).split(" ").filter((w) => w && !STOP.has(w));

// Does a name written in a report fit any of a bill's titles (short or official)? Lenient on
// purpose: one title containing the other, or at least three quarters of the written name's
// words found in the title, counts as a match. Only a name that plainly differs fails.
export function titleMatches(written, titles) {
  const w = normTitle(written);
  const wt = tokens(written);
  if (!w || !wt.length) return true; // nothing to compare
  for (const t of titles ?? []) {
    const n = normTitle(t);
    if (!n) continue;
    if (n.includes(w) || w.includes(n)) return true;
    const tt = new Set(tokens(t));
    if (wt.filter((x) => tt.has(x)).length / wt.length >= 0.75) return true;
  }
  return false;
}
