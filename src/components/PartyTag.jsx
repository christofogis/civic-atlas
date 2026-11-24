import { partyTag, partyName } from "../lib/format.js";

// Party as a small badge: the letter always shows, so the color is a reading aid, not the meaning.
// D blue, R red, independents and others neutral grey. Used on names only.
const KIND = { Democrat: "d", Republican: "r" };
export const partyClass = (party) => `party party-${KIND[party] ?? "other"}`;

// "D-CA-12" style tag for a member: { party, state, district, chamber }.
export function PartyTag({ p }) {
  if (!p?.party) return null;
  return <span className={partyClass(p.party)} title={partyName(p.party)}>{partyTag(p)}</span>;
}

// The party name as a badge, e.g. on a member's header line.
export function PartyName({ party }) {
  if (!party) return null;
  return <span className={partyClass(party)}>{partyName(party)}</span>;
}
