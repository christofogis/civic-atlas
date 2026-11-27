// Statewide ballot measures: reading the Secretary of State's measure lists, and grouping measures
// by the election they're on. Shared by scripts/data/measures.mjs and the site.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// A page's HTML as plain lines, the way the build compares it: tags become line breaks.
export function pageText(html) {
  return html.replace(/<[^>]+>/g, "\n").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ");
}

// Measure numbers as the pages print them -> our ids: "ACA 7" -> "aca-7", "SB 895" -> "sb-895",
// "1995. (25-0018A1)" (an initiative's number and AG file) -> "1995".
const ID_RE = /\b(?:A|S)CA\s?\d+|\bA[BJ]R?\s?\d+|\bSB\s?\d+|\b(?:19|20)\d{2}\.\s?\(\d{2}-\d{4}/g;
export function measureId(printed) {
  const s = printed.replace(/\s/g, "").replace(/\.\(.*$/, "").toLowerCase();
  return /^\d+$/.test(s) ? s : s.replace(/^([a-z]+)(\d+)$/, "$1-$2");
}

// Every section for an election in `year`, in page order: { heading, month, day, ids }. Headings
// read "March 7, 2028, Statewide Ballot Measures" on the qualified page and "November 2028 Eligible
// Statewide Ballot Measures" on the eligible page (month only). A section runs to the next heading
// or to the page's closing notes.
export function electionSections(text, year) {
  // Headings for any year mark where a section ends; only `year`'s are returned.
  const head = new RegExp(`^\\s*(${MONTHS.join("|")})(?:\\s+(\\d{1,2}),)?\\s+((?:19|20)\\d{2})\\b[^\\n]*Ballot Measures\\s*$`, "gm");
  const heads = [...text.matchAll(head)];
  return heads.map((h, i) => {
    const start = h.index + h[0].length;
    const next = heads[i + 1]?.index ?? text.length;
    const body = text.slice(start, next).split(/\n(?=\s*(?:As new initiatives|For those measures|Initiatives and Referendum\s*\n))/)[0];
    return {
      heading: h[0].trim(),
      year: Number(h[3]),
      month: MONTHS.indexOf(h[1]) + 1,
      day: h[2] ? Number(h[2]) : null,
      ids: [...new Set([...body.matchAll(ID_RE)].map((x) => measureId(x[0])))],
    };
  }).filter((s) => s.year === year);
}

// Does a section's heading name this election date (YYYY-MM-DD)? A month-only heading matches any
// day in that month.
export function sectionMatches(section, electionDate) {
  const [, m, d] = electionDate.split("-").map(Number);
  return section.month === m && (section.day == null || section.day === d);
}

// Problems between our list and a page's sections: a measure the state lists that we don't have,
// or have on a different election.
export function compareSections(sections, measures, pageName) {
  const problems = [];
  for (const s of sections) {
    for (const id of s.ids) {
      const m = measures.find((x) => x.id === id);
      if (!m) problems.push(`${pageName} page lists ${id} under "${s.heading}", which isn't in our list`);
      else if (!sectionMatches(s, m.election)) problems.push(`${pageName} page lists ${id} under "${s.heading}", but our list has it on ${m.election}`);
    }
  }
  return problems;
}

// Measures grouped by election, in date order: [{ date, name, measures }]. Elections with no
// measures are left out.
export function byElection(data) {
  return (data?.elections ?? [])
    .map((e) => ({ ...e, measures: data.measures.filter((m) => m.election === e.date) }))
    .filter((e) => e.measures.length)
    .sort((a, z) => (a.date < z.date ? -1 : 1));
}

// The next election with a measure on or after `today` (YYYY-MM-DD), or null.
export function nextElection(data, today) {
  return byElection(data).find((e) => e.date >= today) ?? null;
}

// An election's name in Spanish ("Elección primaria estatal del 7 mar 2028"), from its English name's
// kind and its date, formatted by `fmtDate` (the site's date formatter).
export function electionNameEs(e, fmtDate) {
  const kind = /Primary/.test(e.name) ? "Elección primaria estatal" : /General/.test(e.name) ? "Elección general estatal" : "Elección estatal";
  return `${kind} del ${fmtDate(e.date)}`;
}
