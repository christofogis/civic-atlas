import { Link } from "react-router-dom";
import { splitBillRefs } from "../../lib/billrefs.js";

// Official text with every bill number in it linked to that bill's page in the given Congress.
// The words are shown exactly as published; only links are added.
export default function LinkedText({ text, congress }) {
  if (!text) return null;
  if (!congress) return text;
  return splitBillRefs(text).map((p, i) => p.bill_type
    ? <Link key={i} to={`/bill/${congress}/${p.bill_type}/${p.number}`}>{p.text}</Link>
    : p.text);
}
