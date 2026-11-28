import { db } from "./db.js";

// Everything the top of a bill page needs, in parallel. Started as early as possible: main.jsx calls
// it on a bill URL before the page's own code has downloaded (as for member pages), and the page
// picks up the same request. Kept briefly so going back to a bill doesn't refetch.
const cache = new Map();
export function loadBill(congress, type, number) {
  const k = `${congress}-${type}-${number}`;
  if (!cache.has(k)) {
    const p = fetchBill(congress, type, number);
    p.catch(() => cache.delete(k));
    cache.set(k, p);
    setTimeout(() => cache.delete(k), 5 * 60 * 1000);
  }
  return cache.get(k);
}

async function fetchBill(congress, type, number) {
  const one = (q) => q.then(({ data, error }) => { if (error) throw error; return data; });
  const key = (q) => q.eq("congress", congress).eq("bill_type", type).eq("number", number);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const [bill, sponsor, cosponsors, votes, lobbying, lobbyCount, freshness, scheduled, meetings, former, referrals, plain, simple] = await Promise.all([
    one(key(db.from("bills").select("*")).maybeSingle()),
    one(key(db.from("bill_sponsor_details").select("*")).maybeSingle()),
    one(key(db.from("bill_cosponsor_details").select("*")).order("sponsored_date").order("last_name")),
    one(db.from("votes").select("vote_id,chamber,voted_at,question,description,document_name,result,required,amendment_ref,bill_type,bill_number,yea_total,nay_total,present_total,not_voting_total,source_url")
      .eq("bill_congress", congress).eq("bill_type", type).eq("bill_number", number).order("voted_at", { ascending: false })),
    // Lobbying is the heaviest query; if it fails, the rest of the page still shows.
    one(key(db.from("bill_lobbying_clients").select("*")).order("quarters", { ascending: false }).order("client_name").limit(1000)).catch(() => null),
    one(key(db.from("bill_lobbying_totals").select("clients")).maybeSingle()).catch(() => null),
    one(db.from("data_freshness").select("*")),
    one(db.from("upcoming_events").select("event_id,chamber,kind,event_date,event_time,week_of,category,committee_id,committee_name,title,source_url")
      .contains("bill_refs", [`${congress}-${type}-${number}`]).gte("event_date", weekAgo).order("event_date")),
    one(db.from("committee_meetings").select("event_id,meeting_at,title,meeting_type,status,committee_ids")
      .contains("bill_refs", [`${congress}-${type}-${number}`]).order("meeting_at", { ascending: false }).limit(50)).catch(() => []),
    one(key(db.from("bill_lobbying_former").select("lobbyist_name,covered_position,clients,last_quarter_key,latest_filing_uuid"))
      .order("lobbyist_name").limit(500)).catch(() => []),
    // Committee referrals, for the "Committee" step and the record behind the track.
    one(key(db.from("bill_committees").select("committee_id,first_activity_date,activities,committees(name,parent_id)")).order("first_activity_date")).catch(() => []),
    // The AI plain-language summary, if one passed its check (an aid; the page shows without it).
    one(key(db.from("bill_plain_summaries").select("lead_en,lead_es,points_en,points_es")).maybeSingle()).catch(() => null),
    // Its simpler version ("Explain it simply"), if one passed its check.
    one(key(db.from("bill_simple_summaries").select("text_en,text_es")).maybeSingle()).catch(() => null),
  ]);
  return { plain, simple, bill, sponsor, cosponsors, votes, lobbying, lobbyTotal: lobbyCount?.clients ?? lobbying?.length ?? 0, freshness, scheduled, meetings, former, referrals };
}
