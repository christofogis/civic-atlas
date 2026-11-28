import { useId } from "react";

// One block of a page: a bold heading, an optional short line under it, then the content, on a
// card. The same frame on every list-heavy page (Chris, Nov 28, 2026), so a reader always knows
// which section they're in. `level` keeps the page's heading order (h2 under the page's h1).
export default function SectionCard({ id, title, sub, level = 2, className = "", headExtra, children }) {
  const hid = useId();
  const H = `h${level}`;
  return (
    <section id={id} className={`section sec-card ${className}`.trim()} aria-labelledby={hid}>
      <div className="sec-head">
        <H id={hid}>{title}{headExtra}</H>
        {sub && <p className="sec-sub">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

// A headline figure: the number in the accent green, what it counts under it. With `href` the
// figure is a link to the items it counts; `onOpen` runs first (e.g. to open that section's
// disclosure), so the link still works where scripts don't.
export function Stat({ n, label, href, onOpen }) {
  const body = <><strong>{n}</strong><span>{label}</span></>;
  if (!href) return <div className="stat">{body}</div>;
  return <a className="stat stat-link" href={href} onClick={onOpen && ((e) => { e.preventDefault(); onOpen(); })}>{body}</a>;
}
export const Stats = ({ children }) => <div className="stats">{children}</div>;
