// Presidents and vice presidents, and executive orders.
// Sources: unitedstates/congress-legislators executive.yaml (public domain);
// Federal Register API (no key): executive orders signed since Jan 20, 2017.
import { parse } from "yaml";
import { getClient, upsertBatches, withRun } from "./lib.mjs";

const db = getClient();
const FR = "https://www.federalregister.gov/api/v1/documents.json";
const FIELDS = ["document_number", "executive_order_number", "title", "signing_date", "publication_date", "president", "citation", "html_url", "pdf_url"];

await withRun(db, "executive", async () => {
  const res = await fetch("https://raw.githubusercontent.com/unitedstates/congress-legislators/main/executive.yaml");
  if (!res.ok) throw new Error(`executive.yaml ${res.status}`);
  const terms = [];
  for (const p of parse(await res.text())) {
    const name = p.name.official_full ?? [p.name.nickname ?? p.name.first, p.name.last].filter(Boolean).join(" ");
    for (const t of p.terms ?? []) {
      if (!["prez", "viceprez"].includes(t.type)) continue;
      terms.push({ person_key: p.id?.bioguide ?? name, name, type: t.type, start_date: t.start, end_date: t.end ?? null,
        party: t.party ?? null, bioguide_id: p.id?.bioguide ?? null });
    }
  }
  await upsertBatches(db, "executive_terms", terms, "person_key,type,start_date");

  const orders = [];
  for (let page = 1; ; page++) {
    const q = new URLSearchParams({ "conditions[type][]": "PRESDOCU", "conditions[presidential_document_type][]": "executive_order",
      "conditions[signing_date][gte]": "2017-01-20", per_page: "500", page: String(page), order: "newest" });
    FIELDS.forEach((f) => q.append("fields[]", f));
    const r = await fetch(`${FR}?${q}`);
    if (!r.ok) throw new Error(`Federal Register ${r.status}`);
    const body = await r.json();
    for (const d of body.results ?? []) {
      orders.push({ document_number: d.document_number, eo_number: d.executive_order_number ? Number(d.executive_order_number) : null,
        title: d.title, signing_date: d.signing_date ?? null, publication_date: d.publication_date ?? null,
        president: d.president?.name ?? null, citation: d.citation ?? null, html_url: d.html_url, pdf_url: d.pdf_url ?? null });
    }
    if (!body.next_page_url || !(body.results ?? []).length) break;
  }
  await upsertBatches(db, "executive_orders", orders, "document_number");
  console.log(`executive terms ${terms.length}, executive orders ${orders.length}`);
  return { rows_updated: terms.length + orders.length };
});
