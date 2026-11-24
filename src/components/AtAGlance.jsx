import { Explain } from "./Explain.jsx";
import { ordinal, money, date } from "../lib/format.js";
import Scale from "./Scale.jsx";

const MIN_SPLIT_VOTES = 20;
const pct = (n, d) => `${Math.round((100 * n) / d)}%`;
const rate = (x) => `${Math.round(100 * x)}%`;

// A plain-language summary at the top of a member page. Every sentence is filled in by code
// from the records below, in the same words for every member; a sentence is left out only
// when there's no record for it. Nothing here is written by AI.
export default function AtAGlance({ terms, voteStats, medians, billStats, laws, finance, bySize, tradeSummary, delegate }) {
  const lines = [];
  const first = terms.length ? terms.reduce((a, t) => (t.start_date < a ? t.start_date : a), terms[0].start_date) : null;
  if (first) lines.push(<>First took office in Congress in {first.slice(0, 4)}.</>);

  const s = voteStats[0];
  if (s && s.roll_calls > 0) {
    const med = medians.find((x) => x.congress === s.congress && x.chamber === s.chamber);
    const chamber = s.chamber === "house" ? "House member" : "senator";
    lines.push(<>
      In the {ordinal(s.congress)} Congress, voted on {pct(s.roll_calls - s.missed, s.roll_calls)} of <Explain id="roll-call">roll calls</Explain>
      {med && !delegate ? <> (typical {chamber}: {rate(1 - med.median_missed_rate)})</> : null}.
      <Scale value={(s.roll_calls - s.missed) / s.roll_calls} typical={med && !delegate ? 1 - med.median_missed_rate : null}
        label="of roll calls voted on" typicalLabel={`typical ${chamber}`} />
    </>);
    if (s.party_split_votes >= MIN_SPLIT_VOTES && ["Democrat", "Republican"].includes(s.scoring_party)) {
      const side = s.scoring_party === "Democrat" ? "Democratic" : "Republican";
      lines.push(<>
        When most Democrats and most Republicans voted on opposite sides, voted with the {side} side {pct(s.with_party, s.party_split_votes)} of
        the time{med && !delegate ? <> (typical {chamber}: {rate(med.median_party_line_rate)})</> : null}. <Explain id="party-split" />
        <Scale value={s.with_party / s.party_split_votes} typical={med && !delegate ? med.median_party_line_rate : null}
          label={`with the ${side} side`} typicalLabel={`typical ${chamber}`} />
      </>);
    }
  }

  const congress = billStats[0]?.congress;
  if (congress) {
    const sponsored = billStats.filter((b) => b.congress === congress).reduce((n, b) => n + b.sponsored, 0);
    const enacted = laws.filter((l) => l.congress === congress).length;
    lines.push(<>
      Introduced {sponsored.toLocaleString()} bill{sponsored === 1 ? "" : "s"} and resolution{sponsored === 1 ? "" : "s"} in the {ordinal(congress)} Congress;
      {" "}{enacted.toLocaleString()} {enacted === 1 ? "has" : "have"} become law.
    </>);
  }

  const f = finance.find((x) => Number(x.receipts) > 0);
  if (f) {
    const cycleSizes = bySize.filter((b) => b.cycle === f.cycle);
    const total = cycleSizes.reduce((n, b) => n + Number(b.total), 0);
    const small = cycleSizes.filter((b) => b.size_bucket === 0).reduce((n, b) => n + Number(b.total), 0);
    lines.push(<>
      Raised {money(Number(f.receipts))} for the {f.cycle} election cycle{f.coverage_end_date ? <>, through {date(f.coverage_end_date)}</> : null}.
      {total > 0 && <> {pct(small, total)} of contributions from individuals came in amounts <Explain id="small-dollar">under $200</Explain>.</>}
    </>);
  }

  lines.push(tradeSummary
    ? <>Reported {tradeSummary.trades.toLocaleString()} stock transaction{tradeSummary.trades === 1 ? "" : "s"} in {tradeSummary.filings} <Explain id="ptr">report{tradeSummary.filings === 1 ? "" : "s"}</Explain> since 2025.</>
    : <>No stock transaction reports on file since 2025.</>);

  return (
    <section className="glance">
      <h2>At a glance</h2>
      <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      <p className="fine">Filled in from the records below, in the same words for every member.</p>
    </section>
  );
}
