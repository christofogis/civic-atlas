import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "../lib/db.js";
import DownloadCsv from "../components/DownloadCsv.jsx";
import { ordinal, date } from "../lib/format.js";
import { congressOn, congressYears } from "../../lib/congress.js";
import { Explain } from "../components/Explain.jsx";
import VoteBreakdown from "../components/VoteBreakdown.jsx";
import { tr } from "../lib/lang.js";

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
      <h1>{tr("Nominations", "Nominaciones")}</h1>
      <p className="lede">
        {tr("Senate votes on people the President nominated: judges, cabinet members, ambassadors and other officials. Most get a ", "Votaciones del Senado sobre las personas que nominó el Presidente: jueces, miembros del gabinete, embajadores y otros funcionarios. La mayoría tiene una votación de ")}<Explain id="cloture">{tr("cloture", "cloture (cierre del debate)")}</Explain>{tr(" vote to end debate, then a confirmation vote.", " para terminar el debate y luego una votación de confirmación.")}
      </p>
      <div className="filters">
        <label>{tr("Congress", "Congreso")}{" "}
          <select value={congress} onChange={(e) => set("congress", e.target.value)}>
            {Array.from({ length: CURRENT - 117 }, (_, i) => CURRENT - i).map((c) => <option key={c} value={c}>{ordinal(c)} ({congressYears(c)})</option>)}
          </select>
        </label>
        <label>{tr("Search", "Buscar")}{" "}
          <input type="search" value={q} placeholder={tr("Name or position, e.g. judge", "Nombre o cargo, p. ej., judge (en inglés)")} onChange={(e) => set("q", e.target.value)} />
        </label>
      </div>
      {!rows ? <p>{tr("Loading…", "Cargando…")}</p> : (
        <>
          <p role="status">{tr(`${filtered.length.toLocaleString()} nomination${filtered.length === 1 ? "" : "s"} with a recorded vote.`, `${filtered.length.toLocaleString()} nominaci${filtered.length === 1 ? "ón" : "ones"} con votación registrada.`)}</p>
          <table>
            <thead><tr><th>{tr("Nominee", "Persona nominada")}</th><th>Cloture</th><th>{tr("Confirmation", "Confirmación")}</th></tr></thead>
            <tbody>
              {filtered.slice(0, shown).map((n) => {
                const voteId = n.confirmation_vote_id ?? n.cloture_vote_id;
                return [
                  <tr key={n.document_name}>
                    <td>
                      <strong>{n.nominee}</strong>
                      <div className="fine">{n.position} · <a href={`https://www.congress.gov/nomination/${n.congress}th-congress/${n.document_name.replace(/^PN/, "").split("-")[0]}`}>{n.document_name}</a></div>
                      <button className="link fine" aria-expanded={open === voteId} onClick={() => setOpen(open === voteId ? null : voteId)}>
                        {open === voteId ? tr("Hide how senators voted", "Ocultar cómo votaron") : tr("How senators voted", "Cómo votaron los senadores")}
                      </button>
                    </td>
                    <td className="fine">{n.cloture_result ? <>{n.cloture_result}<div>{date(n.cloture_at)}</div></> : "—"}</td>
                    <td>{n.confirmation_result
                      ? <><a href={n.confirmation_url}>{n.confirmation_result}</a><div className="fine">{date(n.confirmation_at)}</div></>
                      : <span className="fine">{tr("No confirmation vote yet", "Todavía sin votación de confirmación")}</span>}</td>
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
          {filtered.length > shown && <p><button className="link" onClick={() => setShown(shown + PAGE)}>{tr("Show more", "Mostrar más")}</button></p>}
        </>
      )}
      <p className="fine">
        {tr("Source: Senate roll-call votes (senate.gov). Nominations confirmed by voice vote, by unanimous consent or together in one resolution have no individual roll call and aren't listed. Breakdown shows the confirmation vote, or the cloture vote when there was no confirmation vote.",
          "Fuente: votaciones nominales del Senado (senate.gov). Las nominaciones confirmadas a viva voz, por consentimiento unánime o en conjunto en una sola resolución no tienen votación nominal individual y no se listan. El desglose muestra la votación de confirmación, o la de cloture cuando no hubo confirmación.")}
      </p>
    </main>
  );
}
