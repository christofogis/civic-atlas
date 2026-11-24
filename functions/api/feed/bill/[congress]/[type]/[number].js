// GET /api/feed/bill/:congress/:type/:number  ->  RSS: the bill's milestones, roll-call votes and
// scheduled floor or committee action.
import { rss } from "../../../../../../lib/feeds.js";
import { rest, cached } from "../../../../../../lib/rest.js";

const TYPES = new Set(["hr", "s", "hres", "sres", "hjres", "sjres", "hconres", "sconres"]);
const LABEL = { hr: "H.R.", s: "S.", hres: "H.Res.", sres: "S.Res.", hjres: "H.J.Res.", sjres: "S.J.Res.", hconres: "H.Con.Res.", sconres: "S.Con.Res." };
const MILESTONES = [
  ["introduced_date", "Introduced"], ["reported_date", "Reported by committee"],
  ["passed_house_date", "Passed the House"], ["failed_house_date", "Failed in the House"],
  ["passed_senate_date", "Passed the Senate"], ["failed_senate_date", "Failed in the Senate"],
  ["presented_date", "Sent to the President"], ["vetoed_date", "Vetoed"], ["became_law_date", "Became law"],
];

export async function onRequestGet(context) {
  const congress = Number(context.params.congress);
  const type = String(context.params.type ?? "").toLowerCase();
  const number = Number(String(context.params.number ?? "").replace(/\.(xml|rss)$/, ""));
  if (!Number.isInteger(congress) || !TYPES.has(type) || !Number.isInteger(number)) return new Response("Not found", { status: 404 });
  return cached(context, async () => {
    const origin = new URL(context.request.url).origin;
    const key = `congress=eq.${congress}&bill_type=eq.${type}&number=eq.${number}`;
    const [b] = await rest(`bills?${key}&select=*`);
    if (!b) return new Response("Not found", { status: 404 });
    const label = `${LABEL[type]} ${number}`;
    const page = `${origin}/bill/${congress}/${type}/${number}`;
    const [votes, events] = await Promise.all([
      rest(`votes?bill_congress=eq.${congress}&bill_type=eq.${type}&bill_number=eq.${number}&select=vote_id,chamber,voted_at,question,result,yea_total,nay_total&order=voted_at.desc&limit=40`),
      rest(`upcoming_events?bill_refs=cs.{${congress}-${type}-${number}}&select=event_id,chamber,kind,event_date,event_time,committee_name,title,source_url&order=event_date.desc&limit=20`),
    ]);
    const items = [
      ...MILESTONES.filter(([f]) => b[f]).map(([f, what]) => ({
        guid: `${f}-${congress}-${type}-${number}`, date: b[f], link: page,
        title: `${label}: ${what}${f === "became_law_date" && b.law_number ? ` (${b.law_number})` : ""}`,
      })),
      ...votes.map((v) => ({
        guid: `vote-${v.vote_id}`, date: v.voted_at, link: page,
        title: `${v.chamber === "house" ? "House" : "Senate"} vote: ${v.question}: ${v.result} (${v.yea_total}–${v.nay_total})`,
      })),
      ...events.map((e) => ({
        guid: `event-${e.event_id}`, date: e.event_date, link: e.source_url,
        title: e.kind === "floor" ? `${label} on the House floor schedule, week of ${e.event_date}` : `Scheduled: ${e.committee_name ?? ""} ${e.kind}, ${e.event_date}${e.event_time ? ` ${e.event_time} ET` : ""}`,
      })),
    ].sort((a, z) => String(z.date).localeCompare(String(a.date)));
    return new Response(rss({
      title: `${label}: ${b.short_title ?? b.title} — Civic Atlas`, link: page,
      description: `Milestones, roll-call votes and scheduled action on ${label} (${congress}th Congress), from official records.`,
      items,
    }), { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=1800" } });
  });
}
