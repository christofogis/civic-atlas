// The fixed rule for which bills the quiz (/quiz) asks about, shared by the page and by the job that
// writes the simpler summaries (scripts/ingest/bill-simple-summaries.mjs, which does the quiz bills
// first), so the two can't drift apart. No one picks the bills.
import { voteKind } from "./voteKind.js";

export const QUIZ_QUESTIONS = 10;
export const QUIZ_CANDIDATES = 40;
export const MIN_SHARE = 0.1;   // each side needs at least 10% of the votes, so the vote was contested

// votes: the current Congress's roll calls on bills, newest first. Returns up to QUIZ_CANDIDATES
// bills, newest first: {key: "congress-type-number", votes: {house?, senate?}} with the latest
// contested final-passage vote in each chamber. The page then keeps the first QUIZ_QUESTIONS that
// have a CRS summary.
export function quizCandidates(votes) {
  const byBill = new Map();
  for (const v of votes ?? []) {
    if (!v.bill_type) continue;
    const cast = (v.yea_total ?? 0) + (v.nay_total ?? 0);
    if (voteKind(v).kind !== "passage" || cast <= 0 || Math.min(v.yea_total ?? 0, v.nay_total ?? 0) / cast < MIN_SHARE) continue;
    const k = `${v.bill_congress}-${v.bill_type}-${v.bill_number}`;
    const entry = byBill.get(k) ?? { key: k, votes: {} };
    entry.votes[v.chamber] ??= v;   // latest final vote in each chamber
    byBill.set(k, entry);
  }
  return [...byBill.values()].slice(0, QUIZ_CANDIDATES);
}
