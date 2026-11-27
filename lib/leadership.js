// Pure helpers for leadership roles and Speaker elections (no React, no database).

// Today in Washington as YYYY-MM-DD.
export const todayEastern = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);

// A role is current from its start date until the day before its end date (an end date is the
// first day not served, as with terms). An open end means the source lists no end yet.
export function isCurrentRole(role, today = todayEastern()) {
  return Boolean(role?.start_date) && role.start_date <= today && (!role.end_date || role.end_date > today);
}

// Chamber posts first, in the same order for both chambers; every other title after them,
// alphabetically, so no party's officers are placed ahead of another's.
const CHAMBER_POSTS = {
  house: ["Speaker of the House", "House Majority Leader", "House Minority Leader", "House Majority Whip",
    "House Minority Whip", "Assistant Speaker of the House", "Assistant House Majority Leader", "Assistant House Minority Leader"],
  senate: ["President Pro Tempore of the Senate", "Senate Majority Leader", "Senate Minority Leader", "Senate Majority Whip",
    "Senate Minority Whip", "Assistant Senate Majority Leader", "Assistant Senate Minority Leader"],
};
export const isChamberPost = (role) => (CHAMBER_POSTS[role.chamber] ?? []).includes(role.title);

export function roleOrder(a, b) {
  const rank = (r) => { const i = (CHAMBER_POSTS[r.chamber] ?? []).indexOf(r.title); return i < 0 ? 99 : i; };
  return rank(a) - rank(b) || a.title.localeCompare(b.title) || a.start_date.localeCompare(b.start_date)
    || a.bioguide_id.localeCompare(b.bioguide_id);
}

// Current roles, ordered; optionally only one member's.
export function currentRoles(rows, today = todayEastern(), bioguideId = null) {
  return (rows ?? []).filter((r) => isCurrentRole(r, today) && (!bioguideId || r.bioguide_id === bioguideId)).sort(roleOrder);
}

// Speaker elections. Positions on these roll calls are candidates' names as the Clerk records
// them, plus "Present" and "Not Voting". tallies: rows of { vote_id, position, position_category, votes }.
// A Speaker is elected by a majority of the votes cast for a person by name; "Present" and
// "Not Voting" are not counted toward it.
export function ballotTally(rows) {
  const list = (rows ?? []).map((r) => ({ position: r.position, category: r.position_category, votes: Number(r.votes) }));
  const named = list.filter((r) => r.category === "other");
  const cast = named.reduce((s, r) => s + r.votes, 0);
  const needed = cast ? Math.floor(cast / 2) + 1 : null;
  const order = (a, b) => b.votes - a.votes || a.position.localeCompare(b.position);
  const candidates = [...named].sort(order);
  const others = list.filter((r) => r.category !== "other").sort(order);
  const top = candidates[0];
  const majority = top && needed && top.votes >= needed ? top.position : null;
  return { candidates, others, cast, needed, majority };
}

// Group ballots into elections: a new election starts in a new Congress or after a ballot on which
// a candidate received a majority. votes: { vote_id, congress, voted_at, ... }; tallies by vote_id.
// Returns elections newest first, each with ballots in the order taken (ballot = 1, 2, ...).
export function speakerElections(votes, talliesByVote) {
  const sorted = [...(votes ?? [])].sort((a, b) => a.voted_at.localeCompare(b.voted_at));
  const elections = [];
  let current = null;
  for (const v of sorted) {
    if (!current || current.congress !== v.congress || current.elected) {
      current = { congress: v.congress, ballots: [], elected: null };
      elections.push(current);
    }
    const tally = ballotTally(talliesByVote?.get?.(v.vote_id) ?? talliesByVote?.[v.vote_id]);
    current.ballots.push({ ...v, ballot: current.ballots.length + 1, tally });
    if (tally.majority) current.elected = { name: tally.majority, ballot: current.ballots.length, vote: v, tally };
  }
  for (const e of elections) {
    e.first = e.ballots[0].voted_at;
    e.last = e.ballots.at(-1).voted_at;
  }
  return elections.reverse();
}
