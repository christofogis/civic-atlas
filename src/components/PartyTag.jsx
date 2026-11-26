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

// The party as its letter badge followed by its name ("D Democrat"), the same pattern as state
// officials' cards, so every level reads alike.
export function PartyName({ party }) {
  if (!party) return null;
  const name = partyName(party);
  return <span className="party-name"><span className={partyClass(party)} aria-hidden="true">{party === "Democrat" ? "D" : party === "Republican" ? "R" : name.slice(0, 1)}</span> {name}</span>;
}
