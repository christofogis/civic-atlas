import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import DownloadCsv from "../components/DownloadCsv.jsx";
import { ordinal, date } from "../lib/format.js";
import { congressOn, congressYears } from "../../lib/congress.js";
import { Explain } from "../components/Explain.jsx";
import VoteBreakdown from "../components/VoteBreakdown.jsx";

const CURRENT = congressOn();
const PAGE = 50;

// Senate votes on presidential nominations: who was nominated to what, the cloture vote and the
// confirmation vote, with how each senator voted.
export default function Nominations() {
  const [params, setParams] = useSearchParams();
  const congress = Number(params.get("congress")) || CURRENT;
  const q = params.get("q") ?? "";
  const [rows, setRows] = useState(null);
  const [open, setOpen] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const set = (k, v) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n, { replace: true }); setShown(PAGE); };

  useEffect(() => {
    setRows(null);
    db.from("nominations").select("*").eq("congress", congress).order("last_vote_at", { ascending: false }).limit(1000)
      .then(({ data }) => setRows(data ?? []));
  }, [congress]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => !t || `${r.nominee} ${r.position}`.toLowerCase().includes(t));
  }, [rows, q]);

  return (
    <main className="page wide">
      <h1>Nominations</h1>
      <p className="lede">
        Senate votes on people the President nominated: judges, cabinet members, ambassadors and other officials.
        Most get a <Explain id="cloture">cloture</Explain> vote to end debate, then a confirmation vote.
      </p>
      <div className="filters">
        <label>Congress{" "}
          <select value={congress} onChange={(e) => set("congress", e.target.value)}>
            {Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i).map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
          </select>
        </label>
        <label>Search{" "}
          <input type="search" value={q} placeholder="Name or position, e.g. judge" onChange={(e) => set("q", e.target.value)} />
        </label>
      </div>
      {!rows ? <p>Loading…</p> : (
        <>
          <p role="status">{filtered.length.toLocaleString()} nomination{filtered.length === 1 ? "" : "s"} with a recorded vote.</p>
          <table>
            <thead><tr><th>Nominee</th><th>Cloture</th><th>Confirmation</th></tr></thead>
            <tbody>
              {filtered.slice(0, shown).map((n) => {
                const voteId = n.confirmation_vote_id ?? n.cloture_vote_id;
                return [
                  <tr key={n.document_name}>
                    <td>
                      <strong>{n.nominee}</strong>
                      <div className="fine">{n.position} · <a href={`https://www.congress.gov/nomination/${n.congress}th-congress/${n.document_name.replace(/^PN/, "").split("-")[0]}`}>{n.document_name}</a></div>
                      <button className="link fine" aria-expanded={open === voteId} onClick={() => setOpen(open === voteId ? null : voteId)}>
                        {open === voteId ? "Hide how senators voted" : "How senators voted"}
                      </button>
                    </td>
                    <td className="fine">{n.cloture_result ? <>{n.cloture_result}<div>{date(n.cloture_at)}</div></> : "—"}</td>
                    <td>{n.confirmation_result
                      ? <><a href={n.confirmation_url}>{n.confirmation_result}</a><div className="fine">{date(n.confirmation_at)}</div></>
                      : <span className="fine">No confirmation vote yet</span>}</td>
                  </tr>,
                  open === voteId && <tr key={`${n.document_name}-b`}><td colSpan={3}><VoteBreakdown voteId={voteId} /></td></tr>,
                ];
              })}
            </tbody>
          </table>
          <DownloadCsv rows={filtered} filename={`nominations-${congress}`} columns={[
            ["Nomination", (n) => n.document_name], ["Nominee", (n) => n.nominee], ["Position", (n) => n.position],
            ["Cloture result", (n) => n.cloture_result], ["Cloture date", (n) => n.cloture_at?.slice(0, 10)],
            ["Confirmation result", (n) => n.confirmation_result], ["Confirmation date", (n) => n.confirmation_at?.slice(0, 10)],
            ["Yeas", (n) => n.yeas], ["Nays", (n) => n.nays], ["Source", (n) => n.confirmation_url],
          ]} />
          {filtered.length > shown && <p><button className="link" onClick={() => setShown(shown + PAGE)}>Show more</button></p>}
        </>
      )}
      <p className="fine">
        Source: Senate roll-call votes (senate.gov). Nominations confirmed by voice vote, by unanimous consent or
        together in one resolution have no individual roll call and aren't listed. Breakdown shows the confirmation
        vote, or the cloture vote when there was no confirmation vote.
      </p>
    </main>
  );
}
