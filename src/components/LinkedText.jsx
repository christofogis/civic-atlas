import { Link } from "react-router-dom";
import { splitBillRefs } from "../../lib/billrefs.js";
import { Terms } from "./Terms.jsx";

// Official text with every bill number in it linked to that bill's page in the given Congress.
// The words are shown exactly as published (in English, so marked lang="en"); only links are added.
// With `terms`, glossary terms outside the links are tappable for their definition (first one each).
export default function LinkedText({ text, congress, terms = false }) {
  if (!text) return null;
  const seen = new Set();   // one block: each term marked once
  const plain = (s, key) => (terms ? <Terms key={key} text={s} lang="en" seen={seen} /> : s);
  if (!congress) return <span lang="en">{plain(text)}</span>;
  return <span lang="en">{splitBillRefs(text).map((p, i) => p.bill_type
    ? <Link key={i} to={`/bill/${congress}/${p.bill_type}/${p.number}`}>{p.text}</Link>
    : plain(p.text, i))}</span>;
}
