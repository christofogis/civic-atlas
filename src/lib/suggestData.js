import { db } from "./db.js";
import { congressOn } from "../../lib/congress.js";
import { parseBillQuery, numberPrefixRanges, rangesFilter, congressesSince118, prefixTsquery } from "./suggest.js";

// Data for the header search suggestions. Members and full committees are small lists (about 700
// and 50 rows), loaded once per visit when the box is first focused and matched in the browser, so
// typing a name costs no request. Bills are looked up as the visitor types (debounced by the caller).

const MEMBER_COLUMNS = "bioguide_id,name,last_name,nickname,chamber,state,district,party,serving";
const BILL_COLUMNS = "congress,bill_type,number,title,short_title,latest_action_date";
const PAGE = 1000; // PostgREST's usual row cap per request

let directory = null;
export function loadDirectory() {
  directory ??= (async () => {
    const rows = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db.from("member_directory").select(MEMBER_COLUMNS)
        .order("bioguide_id").range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < PAGE) return rows;
    }
  })().catch((e) => { directory = null; throw e; });
  return directory;
}

let committees = null;
export function loadCommittees() {
  committees ??= db.from("committees").select("committee_id,name,chamber").is("parent_id", null).order("name")
    .then(({ data, error }) => { if (error) throw error; return data; })
    .catch((e) => { committees = null; throw e; });
  return committees;
}

// Bills for what's typed. A bill number: that number in every Congress we hold (newest first),
// then a few longer numbers starting with the same digits in the Congress in session. Words: titles
// via the bills `search` tsvector, the last word as a prefix, most recent action first. Each query
// reads the bills table directly (not the bill_list view, which joins sponsors) on an index:
// the primary key for numbers, the GIN index on `search` for words.
export async function fetchBills(q, signal) {
  const ref = parseBillQuery(q);
  if (ref) {
    const current = congressOn();
    const exactQ = db.from("bills").select(BILL_COLUMNS).in("congress", congressesSince118(current))
      .eq("bill_type", ref.bill_type).eq("number", ref.number).order("congress", { ascending: false });
    const ranges = numberPrefixRanges(ref.number);
    const prefixQ = ranges.length
      ? db.from("bills").select(BILL_COLUMNS).eq("congress", current).eq("bill_type", ref.bill_type)
        .or(rangesFilter(ranges)).order("number").limit(4)
      : null;
    const [exact, prefix] = await Promise.all([exactQ.abortSignal(signal), prefixQ?.abortSignal(signal)]);
    if (exact.error) throw exact.error;
    if (prefix?.error) throw prefix.error;
    return { byNumber: true, ref, bills: [...exact.data, ...(prefix?.data ?? [])] };
  }
  const words = async (tsq) => {
    const { data, error } = await db.from("bills").select(BILL_COLUMNS)
      .textSearch("search", tsq, { config: "english" })
      .order("latest_action_date", { ascending: false, nullsFirst: false }).limit(5).abortSignal(signal);
    if (error) throw error;
    return data;
  };
  const tsq = prefixTsquery(q);
  if (!tsq) return { byNumber: false, bills: [] };
  let bills = await words(tsq);
  // The English stemmer can make an unfinished word miss ("securi" vs the stored "secur"): one
  // more try with it shortened.
  const shorter = prefixTsquery(q, { trim: 2 });
  if (!bills.length && shorter && shorter !== tsq) bills = await words(shorter);
  return { byNumber: false, bills };
}
