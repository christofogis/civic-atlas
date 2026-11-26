// Orange County Board of Supervisors: each supervisor's votes as recorded in the Clerk's summary
// action minutes (public/data/local/ca-orange-minutes.json). A vote is counted only where a vote
// line names the supervisor; nothing is inferred. Shared by the Board-wide table and each
// supervisor's own card so the two always agree.

export const BOARD_SIZE = 5;
export const KINDS = ["Ayes", "Noes", "Abstained", "Absent", "Excused"];

// The minutes name supervisors by surname ("Wagner"); the officials file has full names
// ("Donald P. Wagner").
export const surname = (name) => name.trim().split(/\s+/).at(-1).replace(/[.,]/g, "");
const same = (a, b) => a.toLowerCase() === b.toLowerCase();

const named = (a) => Object.values(a.votes).flat();
// A motion whose vote lines name fewer than the whole Board.
export const partialLine = (a) => named(a).length > 0 && named(a).length < BOARD_SIZE;

function ref(m, i) {
  return { date: m.date, time: m.time, special: Boolean(m.special), number: i.number, text: i.text, url: m.minutes_url };
}

// One supervisor's record: counts by kind, the items behind every vote other than Aye, the
// motions whose vote lines name others but not this supervisor, and actions that describe a vote
// in a paragraph instead of vote lines (not counted for anyone).
export function supervisorRecord(minutes, name) {
  const meetings = minutes?.meetings ?? [];
  const who = surname(name);
  const counts = Object.fromEntries(KINDS.map((k) => [k, 0]));
  const other = [];
  let unnamed = 0;
  const inText = [];
  for (const m of meetings) for (const i of m.items) for (const a of i.actions) {
    if (a.vote_in_text) inText.push(ref(m, i));
    let found = false;
    for (const [kind, names] of Object.entries(a.votes)) {
      if (!names.some((n) => same(n, who))) continue;
      found = true;
      counts[kind] = (counts[kind] ?? 0) + 1;
      if (kind !== "Ayes") other.push({ ...ref(m, i), kind, partial: partialLine(a) });
    }
    if (!found && named(a).length > 0) unnamed += 1;
  }
  return {
    meetings: meetings.length,
    from: meetings.at(-1)?.date ?? null,
    to: meetings[0]?.date ?? null,
    counts, other, unnamed, inText,
  };
}

// Every name the vote lines use, with that supervisor's record, sorted by name.
export function boardRecords(minutes) {
  const names = new Set();
  for (const m of minutes?.meetings ?? []) for (const i of m.items) for (const a of i.actions) for (const n of named(a)) names.add(n);
  return [...names].sort((a, z) => a.localeCompare(z)).map((n) => ({ name: n, ...supervisorRecord(minutes, n) }));
}
