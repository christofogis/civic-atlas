import { Explain } from "./Explain.jsx";
import { ordinal, money, date } from "../lib/format.js";
import Scale from "./Scale.jsx";
import { tr } from "../lib/lang.js";

const MIN_SPLIT_VOTES = 20;
const pct = (n, d) => `${Math.round((100 * n) / d)}%`;
const rate = (x) => `${Math.round(100 * x)}%`;

// A plain-language summary at the top of a member page. Every sentence is filled in by code
// from the records below, in the same words for every member; a sentence is left out only
// when there's no record for it. Nothing here is written by AI.
export default function AtAGlance({ terms, voteStats, medians, billStats, laws, finance, bySize, tradeSummary, delegate, note }) {
  const lines = [];
  const first = terms.length ? terms.reduce((a, t) => (t.start_date < a ? t.start_date : a), terms[0].start_date) : null;
  if (first) lines.push(<>{tr(`First took office in Congress in ${first.slice(0, 4)}.`, `Asumió por primera vez un cargo en el Congreso en ${first.slice(0, 4)}.`)}</>);

  const s = voteStats[0];
  if (s && s.roll_calls > 0) {
    const med = medians.find((x) => x.congress === s.congress && x.chamber === s.chamber);
    const chamber = s.chamber === "house" ? tr("House member", "miembro de la Cámara") : tr("senator", "miembro del Senado");
    lines.push(<>
      {tr(`In the ${ordinal(s.congress)} Congress, voted on ${pct(s.roll_calls - s.missed, s.roll_calls)} of `, `En el ${ordinal(s.congress)} Congreso, votó en el ${pct(s.roll_calls - s.missed, s.roll_calls)} de las `)}<Explain id="roll-call">{tr("roll calls", "votaciones nominales")}</Explain>
      {med && !delegate ? <> ({tr("typical", "típico")} {chamber}: {rate(1 - med.median_missed_rate)})</> : null}.
      <Scale value={(s.roll_calls - s.missed) / s.roll_calls} typical={med && !delegate ? 1 - med.median_missed_rate : null}
        label={tr("of roll calls voted on", "de votaciones con voto")} typicalLabel={tr(`typical ${chamber}`, `${chamber} típico`)} />
    </>);
    if (s.party_split_votes >= MIN_SPLIT_VOTES && ["Democrat", "Republican"].includes(s.scoring_party)) {
      const side = s.scoring_party === "Democrat" ? tr("Democratic", "demócrata") : tr("Republican", "republicano");
      lines.push(<>
        {tr(`When most Democrats and most Republicans voted on opposite sides, voted with the ${side} side ${pct(s.with_party, s.party_split_votes)} of the time`,
          `Cuando la mayoría de los demócratas y la mayoría de los republicanos votaron en lados opuestos, votó con el lado ${side} el ${pct(s.with_party, s.party_split_votes)} de las veces`)}{med && !delegate ? <> ({tr("typical", "típico")} {chamber}: {rate(med.median_party_line_rate)})</> : null}. <Explain id="party-split" />
        <Scale value={s.with_party / s.party_split_votes} typical={med && !delegate ? med.median_party_line_rate : null}
          label={tr(`with the ${side} side`, `con el lado ${side}`)} typicalLabel={tr(`typical ${chamber}`, `${chamber} típico`)} />
      </>);
    }
  }

  const congress = billStats[0]?.congress;
  if (congress) {
    const sponsored = billStats.filter((b) => b.congress === congress).reduce((n, b) => n + b.sponsored, 0);
    const enacted = laws.filter((l) => l.congress === congress).length;
    lines.push(<>
      {tr(`Introduced ${sponsored.toLocaleString()} bill${sponsored === 1 ? "" : "s"} and resolution${sponsored === 1 ? "" : "s"} in the ${ordinal(congress)} Congress; ${enacted.toLocaleString()} ${enacted === 1 ? "has" : "have"} become law.`,
        `Presentó ${sponsored.toLocaleString()} proyecto${sponsored === 1 ? "" : "s"} de ley y resoluci${sponsored === 1 ? "ón" : "ones"} en el ${ordinal(congress)} Congreso; ${enacted.toLocaleString()} se ${enacted === 1 ? "ha" : "han"} convertido en ley.`)}
    </>);
  }

  const f = finance.find((x) => Number(x.receipts) > 0);
  if (f) {
    const cycleSizes = bySize.filter((b) => b.cycle === f.cycle);
    const total = cycleSizes.reduce((n, b) => n + Number(b.total), 0);
    const small = cycleSizes.filter((b) => b.size_bucket === 0).reduce((n, b) => n + Number(b.total), 0);
    lines.push(<>
      {tr(`Raised ${money(Number(f.receipts))} for the ${f.cycle} election cycle`, `Recaudó ${money(Number(f.receipts))} para el ciclo electoral ${f.cycle}`)}{f.coverage_end_date ? <>{tr(", through ", ", hasta el ")}{date(f.coverage_end_date)}</> : null}.
      {total > 0 && <> {tr(`${pct(small, total)} of contributions from individuals came in amounts `, `El ${pct(small, total)} de las contribuciones de personas fue en montos `)}<Explain id="small-dollar">{tr("under $200", "de menos de $200")}</Explain>.</>}
    </>);
  }

  lines.push(tradeSummary
    ? <>{tr(`Reported ${tradeSummary.trades.toLocaleString()} stock transaction${tradeSummary.trades === 1 ? "" : "s"} in ${tradeSummary.filings} `, `Informó ${tradeSummary.trades.toLocaleString()} transacci${tradeSummary.trades === 1 ? "ón" : "ones"} de acciones en ${tradeSummary.filings} `)}<Explain id="ptr">{tr(`report${tradeSummary.filings === 1 ? "" : "s"}`, `informe${tradeSummary.filings === 1 ? "" : "s"}`)}</Explain>{tr(" since 2025.", " desde 2025.")}</>
    : <>{tr("No stock transaction reports on file since 2025.", "No hay informes de transacciones de acciones desde 2025.")}</>);

  return (
    <section className="glance">
      <h2>{tr("At a glance", "En resumen")}</h2>
      <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <p className="fine">{note ?? tr("Filled in from the records below, in the same words for every member.", "Redactado a partir de los registros de abajo, con las mismas palabras para cada miembro.")}</p>
    </section>
  );
}
