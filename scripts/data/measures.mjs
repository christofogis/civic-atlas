// Statewide ballot measures for California's 2028 elections (March 7 primary, November 7 general;
// each measure carries its election date): reads the hand-kept list in data/measures/ca-2028.json,
// pulls the official wording out of each measure's official PDF (the Attorney General's title and
// summary for an initiative, the Legislative Counsel's Digest for a legislative measure) with
// pdftotext, and writes public/data/measures/ca-2028.json for the site. The words shown are the
// official documents' own; nothing here summarizes or rewrites them.
// Then compares the list with the Secretary of State's qualified and eligible pages, and fails if
// the state lists a 2028 measure we don't have, lists it for another election, or no longer lists
// one we do. A measure whose official PDF is a scan (text_scanned) gets no extracted wording: OCR
// errors would be shown as the official text.
//   node scripts/data/measures.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pageText, electionSections, compareSections } from "../../lib/measures.js";

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
      // Work on the text as one run of words: PDFs break lines (and sometimes paragraphs) anywhere.
      const joined = paragraphs(text).join(" ");
      const i = joined.toUpperCase().indexOf(m.extract.start.toUpperCase());
      if (i < 0) throw new Error(`"${m.extract.start}" not found`);
      const ends = (m.extract.end ?? []).map((e) => joined.indexOf(e, i + m.extract.start.length)).filter((k) => k > i);
      let segment = joined.slice(i, ends.length ? Math.min(...ends) : joined.length).trim();
      if (m.extract.drop_heading) segment = segment.slice(m.extract.start.length).replace(/^[^A-Za-z]+/, "");
      segment = segment.replace(/\s*\(\d{2}-\d{4}A?\d*\.\)\s*$/, "");   // the AG file stamp at the end
      // An AG title and summary: title (through "AMENDMENT." / "STATUTE."), summary, fiscal estimate.
      let parts = [segment];
      if (m.extract.field === "official_summary") {
        const t = /^(.*?(?:AMENDMENT|STATUTE|AMENDMENT AND STATUTE)\.)\s+(.*?)\s*(Summary of estimate by Legislative Analyst.*)$/s.exec(segment);
        if (!t) throw new Error("couldn't split title, summary and fiscal estimate");
        out.official_title = t[1];
        out.fiscal_estimate = t[3].replace(/^Summary of estimate by Legislative Analyst and Director of Finance of fiscal impact on state and local governments:\s*/, "");
        parts = [t[2]];
      }
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

// Compare with the Secretary of State's lists: every 2028 election section on each page (the
// qualified page has one per election date, e.g. March 7 and November 7), each measure under the
// election our list has it on, and every measure of ours still listed on its status's page.
for (const [name, url] of [["qualified", src.sources.qualified], ["eligible", src.sources.eligible]]) {
  const res = await fetch(url, { headers: UA }).catch(() => null);
  if (!res?.ok) { console.log(`${name} page unavailable; not compared`); continue; }
  const sections = electionSections(pageText(await res.text()), 2028);
  if (!sections.length) { console.log(`${name}: no 2028 section`); continue; }
  for (const sct of sections) console.log(`${name}: ${sct.heading}: ${sct.ids.join(", ") || "none listed"}`);
  problems.push(...compareSections(sections, measures, name));
  for (const m of measures.filter((x) => x.status === name)) {
    if (!sections.some((sct) => sct.ids.includes(m.id))) problems.push(`${m.id} is ${name} in ${IN}, but the ${name} page no longer lists it for 2028`);
  }
}

if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
