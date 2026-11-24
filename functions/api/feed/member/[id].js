// GET /api/feed/member/:bioguide  ->  RSS: the member's recent roll-call votes, bills they
// introduced, and stock transaction reports, newest first.
import { rss } from "../../../../lib/feeds.js";
import { rest, cached } from "../../../../lib/rest.js";

const LABEL = { hr: "H.R.", s: "S.", hres: "H.Res.", sres: "S.Res.", hjres: "H.J.Res.", sjres: "S.J.Res.", hconres: "H.Con.Res.", sconres: "S.Con.Res." };

export async function onRequestGet(context) {
  const id = String(context.params.id ?? "").replace(/\.(xml|rss)$/, "");
  if (!/^[A-Z]\d{6}$/.test(id)) return new Response("Not found", { status: 404 });
  return cached(context, async () => {
    const origin = new URL(context.request.url).origin;
    const [m] = await rest(`members?bioguide_id=eq.${id}&select=official_full_name,first_name,last_name`);
    if (!m) return new Response("Not found", { status: 404 });
    const name = m.official_full_name ?? `${m.first_name} ${m.last_name}`;
    const [votes, bills, filings] = await Promise.all([
      rest(`member_votes?bioguide_id=eq.${id}&select=vote_id,position,voted_at,question,result,source_url,bill_congress,bill_type,bill_number,bill_title&order=voted_at.desc&limit=40`),
      rest(`bills?sponsor_bioguide_id=eq.${id}&select=congress,bill_type,number,title,short_title,introduced_date&order=introduced_date.desc&limit=20`),
      rest(`ptr_filings?bioguide_id=eq.${id}&select=filing_id,filed_date,source_url&order=filed_date.desc&limit=10`),
    ]);
    const items = [
      ...votes.map((v) => ({
        guid: `vote-${v.vote_id}`, date: v.voted_at,
        title: `${v.position}: ${v.question}`,
        description: `${v.bill_title ? `${v.bill_title}. ` : ""}Result: ${v.result}.`,
        link: v.bill_type ? `${origin}/bill/${v.bill_congress}/${v.bill_type}/${v.bill_number}` : v.source_url,
      })),
      ...bills.map((b) => ({
        guid: `bill-${b.congress}-${b.bill_type}-${b.number}`, date: b.introduced_date,
        title: `Introduced ${LABEL[b.bill_type] ?? b.bill_type} ${b.number}: ${b.short_title ?? b.title}`,
        link: `${origin}/bill/${b.congress}/${b.bill_type}/${b.number}`,
      })),
      ...filings.map((f) => ({
        guid: `ptr-${f.filing_id}`, date: f.filed_date, title: "Filed a stock transaction report", link: f.source_url,
      })),
    ].filter((i) => i.date).sort((a, z) => String(z.date).localeCompare(String(a.date))).slice(0, 50);
    return new Response(rss({
      title: `${name} — Civic Atlas`, link: `${origin}/member/${id}`,
      description: `Roll-call votes, bills introduced and stock transaction reports for ${name}, from official records.`,
      items,
    }), { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=1800" } });
  });
}
