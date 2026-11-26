import { partyName } from "../lib/format.js";
import { stateParty } from "../lib/stateOffices.js";
import { noPhoto, NO_PHOTO } from "../lib/photo.js";

// An official's portrait, the same everywhere: framed in the party color, with the party letter in
// the corner so the party never rests on color alone. Missing photos show the grey silhouette.
// party: federal ("Democrat") or as a state publishes it ("Democratic-Farmer-Labor").
export function portraitParty(party) {
  if (party === "Democrat") return { letter: "D", kind: "d" };
  if (party === "Republican") return { letter: "R", kind: "r" };
  return stateParty(party) ?? { letter: "", kind: "other" };
}

export default function Portrait({ src, party, alt = "", size = "large", className = "", ...img }) {
  const p = portraitParty(party);
  const title = party === "Democrat" || party === "Republican" ? partyName(party) : party;
  return (
    <span className={`portrait portrait-${size} party-${p.kind}-frame ${className}`.trim()}>
      <img src={src || NO_PHOTO} alt={alt} onError={noPhoto} {...img} />
      {p.letter && <span className={`party party-${p.kind}`} title={title}>{p.letter}</span>}
    </span>
  );
}
