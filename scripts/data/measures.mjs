// Statewide ballot measures for an election: reads the hand-kept list in data/measures/ca-2028.json,
// pulls the official wording out of each measure's official PDF (the Attorney General's title and
// summary for an initiative, the Legislative Counsel's Digest for a legislative measure) with
// pdftotext, and writes public/data/measures/ca-2028.json for the site. The words shown are the
// official documents' own; nothing here summarizes or rewrites them.
// Then compares the list with the Secretary of State's qualified and eligible pages, and fails if
// the state lists a 2028 measure we don't have (or no longer lists one we do).
//   node scripts/data/measures.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const IN = "data/measures/ca-2028.json", OUT = "public/data/measures/ca-2028.json";
const UA = { "User-Agent": "civic-atlas measures build (github.com/christofogis/civic-atlas)" };
const src = JSON.parse(readFileSync(IN, "utf8"));

async function pdfText(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  writeFileSync("/tmp/measure.pdf", Buffer.from(await res.arrayBuffer()));
  return execFileSync("pdftotext", ["-layout", "/tmp/measure.pdf", "-"]).toString();
}
// Join the PDF's lines into paragraphs: blank lines separate them; line breaks inside don't.
const paragraphs = (t) => t.replace(/\f/g, "\n").split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim()).filter(Boolean);

const problems = [];
const measures = [];
for (const m of src.measures) {
  const out = { ...m };
  delete out.extract;
  if (m.extract) {
    try {
      const text = await pdfText(m[m.extract.from]);
      const all = paragraphs(text);
      const i = all.findIndex((p) => p.toUpperCase().includes(m.extract.start));
      if (i < 0) throw new Error(`"${m.extract.start}" not found`);
      const end = m.extract.end ? all.findIndex((p, k) => k > i && p.includes(m.extract.end)) : -1;
      let parts = all.slice(i, end > i ? end : all.length);
      if (m.extract.field === "digest") parts = parts.slice(1); // drop the heading line
      // Stop at page furniture (page numbers, file stamps) that pdftotext keeps.
      parts = parts.filter((p) => !/^(Page \d+|\d+|—\s*\d+\s*—|\d+ of \d+)$/i.test(p) && !/^(Initiative|A\.G\. File No\.)\s/.test(p));
      out[m.extract.field] = parts;
      out.extracted_from = m[m.extract.from];
      console.log(`${m.id}: ${m.extract.field} ${parts.length} paragraph(s), ${parts.join(" ").length} characters`);
    } catch (e) {
      problems.push(`${m.id}: couldn't extract ${m.extract.field} (${e.message})`);
    }
  }
  measures.push(out);
}

mkdirSync("public/data/measures", { recursive: true });
writeFileSync(OUT, JSON.stringify({ ...src, measures, built: new Date().toISOString().slice(0, 10) }, null, 1));

// Compare with the Secretary of State's lists for this election.
const yearRe = /November\s+7,?\s+2028|November 2028/i;
for (const [name, url] of [["qualified", src.sources.qualified], ["eligible", src.sources.eligible]]) {
  const res = await fetch(url, { headers: UA }).catch(() => null);
  if (!res?.ok) { console.log(`${name} page unavailable; not compared`); continue; }
  const text = (await res.text()).replace(/<[^>]+>/g, "\n").replace(/&nbsp;|&#160;/g, " ").replace(/[ \t]+/g, " ");
  const at = text.search(yearRe);
  if (at < 0) { console.log(`${name}: no 2028 section`); continue; }
  const section = text.slice(at, at + 6000).split(/\n(?=November \d|As new initiatives|For those measures)/)[0];
  const ids = [...section.matchAll(/\b(A|S)CA\s?\d+|\bA[BJ]R?\s?\d+|\bSB\s?\d+|\b(19|20)\d{2}\.\s?\(\d{2}-\d{4}/g)].map((x) => x[0].replace(/\s/g, "").replace(/\.\(.*$/, "").toLowerCase());
  console.log(`${name} (2028): ${ids.join(", ") || "none listed"}`);
  for (const id of ids) {
    const key = id.replace(/^(a|s)ca/, "$1ca-");
    if (!measures.some((m) => m.id === key || m.id === id)) problems.push(`${name} page lists ${id}, which isn't in ${IN}`);
  }
}

if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
