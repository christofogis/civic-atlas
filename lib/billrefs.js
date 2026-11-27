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
