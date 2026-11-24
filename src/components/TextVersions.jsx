import { useEffect, useState } from "react";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";
import { Explain } from "./Explain.jsx";

const LISTED = 30;
const readUrl = (v) => v.version_code === "law"
  ? v.xml_url.replace(/\/content\/pkg\/(PLAW-[^/]+)\/.*$/, "/app/details/$1")
  : v.xml_url.replace("/xml/", "/html/").replace(/\.xml$/, ".htm");
const fmt = (n) => Number(n).toLocaleString();
const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? "" : "s"}`;
const where = (s) => [...(s.path ?? []), s.header].join(" › ");

function SectionList({ title, rows, total, extra }) {
  const [all, setAll] = useState(false);
  if (!total) return null;
  const shown = all ? rows : rows.slice(0, LISTED);
  return (
    <>
      <h4>{title} ({fmt(total)})</h4>
      <ul className="plain fine">
        {shown.map((s, i) => <li key={i}>{where(s)}{extra?.(s)}</li>)}
      </ul>
      {rows.length > LISTED && !all && <button type="button" className="link fine" onClick={() => setAll(true)}>Show all {fmt(rows.length)}</button>}
      {total > rows.length && <p className="fine">The first {fmt(rows.length)} are listed.</p>}
    </>
  );
}

// Official text versions of a bill and, between consecutive full texts, which sections changed.
export default function TextVersions({ congress, type, number }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    const key = (q) => q.eq("congress", congress).eq("bill_type", type).eq("number", number);
    Promise.all([
      key(db.from("bill_text_versions").select("version_code,seq,version_name,version_date,xml_url,full_text")).order("seq"),
      key(db.from("bill_version_changes").select("*")),
    ]).then(([v, c]) => setData({ versions: v.data ?? [], changes: c.data ?? [] }));
  }, [congress, type, number]);
  if (!data || !data.versions.length) return null;
  const name = Object.fromEntries(data.versions.map((v) => [v.version_code, v.version_name]));
  const changeTo = Object.fromEntries(data.changes.map((c) => [c.to_code, c]));

  return (
    <section className="section">
      <h2>Text versions</h2>
      <p className="fine">Each <Explain id="text-version">version</Explain> is the official text at that step. Where we could compare a version with the one before it, the changes are listed.</p>
      <ol className="plain versions">
        {data.versions.map((v) => {
          const c = changeTo[v.version_code];
          return (
            <li key={v.version_code}>
              <strong>{v.version_name}</strong>{v.version_date && <> · {date(v.version_date)}</>} · <a href={readUrl(v)}>Read the text</a>
              {v.full_text === false && <div className="fine">Lists only the changes this chamber made, so it isn't compared section by section.</div>}
              {c && (
                <details>
                  <summary>
                    Compared with {name[c.from_code] ?? c.from_code}:{" "}
                    {c.added_count + c.removed_count + c.changed_count === 0
                      ? "no changes to the text of any section"
                      : [c.added_count && `${plural(c.added_count, "section")} added`, c.removed_count && `${fmt(c.removed_count)} removed`, c.changed_count && `${fmt(c.changed_count)} changed`].filter(Boolean).join(", ")}
                    {" "}· {fmt(c.words_from)} → {fmt(c.words_to)} words
                  </summary>
                  <SectionList title="Added" rows={c.added} total={c.added_count} />
                  <SectionList title="Removed" rows={c.removed} total={c.removed_count} />
                  <SectionList title="Changed" rows={c.changed} total={c.changed_count}
                    extra={(s) => s.words_to !== s.words_from && <> ({s.words_to > s.words_from ? "+" : "−"}{fmt(Math.abs(s.words_to - s.words_from))} words)</>} />
                  <p className="fine">{plural(c.unchanged_count, "section")} unchanged.</p>
                </details>
              )}
            </li>
          );
        })}
      </ol>
      <p className="fine">
        Source: GovInfo (Government Publishing Office). Comparisons are computed automatically by matching section
        headings: they show where the text changed, not what a change does, so read the text for that. A renamed
        section counts as one removed and one added; renumbering alone isn't counted.
      </p>
    </section>
  );
}
