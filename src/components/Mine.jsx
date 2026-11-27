import { tr } from "../lib/lang.js";

// The yellow highlighter marks the visitor's own representatives (or their committees). Color alone
// says nothing to a screen reader or to someone who can't tell the yellow apart, so each highlighted
// item also carries these words, read aloud but not shown.
export function MineRep() {
  return <span className="visually-hidden">{tr("(your representative) ", "(su representante) ")}</span>;
}
export function MineCommittee() {
  return <span className="visually-hidden">{tr("(your representatives' committee) ", "(comité de sus representantes) ")}</span>;
}
