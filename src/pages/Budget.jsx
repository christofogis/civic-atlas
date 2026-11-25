import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";

// Federal money in and out, from the Treasury's Monthly Treasury Statement (Table 9) and Debt to
// the Penny, built monthly into /data/budget.json by scripts/data/budget.mjs. Category names are
// Treasury's own (shown in English, as published, with a Spanish gloss). No commentary on levels
// or trends: amounts, shares and the source.
const ES = {
  "Individual Income Taxes": "impuestos sobre la renta personal",
  "Corporation Income Taxes": "impuestos sobre la renta de empresas",
  "Social Insurance and Retirement Receipts": "contribuciones al seguro social y la jubilación",
  "Employment and General Retirement": "empleo y jubilación general",
  "Unemployment Insurance": "seguro de desempleo",
  "Other Retirement": "otras jubilaciones",
  "Excise Taxes": "impuestos especiales",
  "Estate and Gift Taxes": "impuestos sobre herencias y donaciones",
  "Customs Duties": "aranceles",
  "Miscellaneous Receipts": "ingresos varios",
  "National Defense": "defensa nacional",
  "International Affairs": "asuntos internacionales",
  "General Science, Space, and Technology": "ciencia, espacio y tecnología",
  "Energy": "energía",
  "Natural Resources and Environment": "recursos naturales y medio ambiente",
  "Agriculture": "agricultura",
  "Commerce and Housing Credit": "comercio y crédito a la vivienda",
  "Transportation": "transporte",
  "Community and Regional Development": "desarrollo comunitario y regional",
  "Education, Training, Employment, and Social Services": "educación, capacitación, empleo y servicios sociales",
  "Health": "salud",
  "Medicare": "Medicare",
  "Income Security": "seguridad de ingresos",
  "Social Security": "Seguro Social",
  "Veterans Benefits and Services": "beneficios y servicios para veteranos",
  "Administration of Justice": "administración de justicia",
  "General Government": "gobierno general",
  "Net Interest": "intereses netos",
  "Undistributed Offsetting Receipts": "ingresos compensatorios no distribuidos",
};
const Label = ({ en }) => <>{en}{ES[en] && tr("", <span className="fine"> ({ES[en]})</span>)}</>;

const IN = "#00b894";   // receipts
const OUT = "#f47230";  // outlays
const BAR = "#0e5a4b";

const sign = (n) => (n < 0 ? "−" : "");
const T = (n) => `${sign(n)}$${(Math.abs(n) / 1e12).toFixed(2)} ${tr("trillion", "billones")}`;
const B = (n) => (Math.abs(n) >= 1e12 ? T(n) : `${sign(n)}$${Math.round(Math.abs(n) / 1e9).toLocaleString()} ${tr("billion", "mil millones")}`);
const per100 = (part, total) => { const v = (100 * part) / total; return v.toFixed(v < 1 ? 2 : v < 10 ? 1 : 0); };
const fyRange = (fy) => tr(`Oct ${fy - 1} – Sep ${fy}`, `oct. ${fy - 1} – sep. ${fy}`);

// Horizontal bars, one series, sorted largest first. Shares are of the positive total.
function Bars({ rows, perHundred, total }) {
  const pos = rows.filter((r) => r.amount > 0).sort((a, z) => z.amount - a.amount);
  const neg = rows.filter((r) => r.amount < 0);
  const max = pos[0]?.amount ?? 1;
  return (
    <>
      <ul className="hbars">
        {pos.map((r) => (
          <li key={r.label}>
            <span className="hbar-label"><Label en={r.label} /></span>
            <span className="hbar-track"><span className="hbar" style={{ width: `${(100 * r.amount) / max}%`, background: BAR }} /></span>
            <span className="hbar-value">
              {B(r.amount)}
              {perHundred && <span className="fine"> · {tr(`$${per100(r.amount, total)} of every $100`, `$${per100(r.amount, total)} de cada $100`)}</span>}
            </span>
            {r.parts && (
              <span className="hbar-parts fine">{r.parts.map((p) => `${p.label}: ${B(p.amount)}`).join(" · ")}</span>
            )}
          </li>
        ))}
      </ul>
      {neg.length > 0 && (
        <p className="fine">
          {tr("Recorded as negative amounts, which reduce the total: ", "Registrados como montos negativos, que reducen el total: ")}
          {neg.map((r, i) => <span key={r.label}>{i > 0 && "; "}<Label en={r.label} /> {B(r.amount)}</span>)}.
        </p>
      )}
    </>
  );
}

// Spending by year, stacked by the six largest budget functions plus everything else, with a
// mark at what came in: the part of a bar above the mark is the deficit. Colors avoid the party
// red and blue; the order was checked for color-blind separation (adjacent segments).
const GROUPS = [
  { key: "Social Security", color: "#00b894" },
  { key: "Medicare", color: "#f47230" },
  { key: "Health", color: "#6a4ce2" },
  { key: "Net Interest", color: "#f2a600" },
  { key: "Income Security", color: "#ee7fac" },
  { key: "National Defense", color: "#008a17" },
];
const OTHER = "#b9c0bc";
function grouped(y) {
  const parts = GROUPS.map((g) => ({ ...g, amount: y.outlays.find((o) => o.label === g.key)?.amount ?? 0 }));
  const rest = y.outlays_total - parts.reduce((a, p) => a + p.amount, 0);
  return [...parts, { key: "Everything else", color: OTHER, amount: rest }];
}
const groupName = (k) => (k === "Everything else" ? tr("Everything else", "Todo lo demás") : <Label en={k} />);

function Stacked({ years }) {
  const [share, setShare] = useState(false);
  const [sel, setSel] = useState(years.length - 1);
  const W = 480, H = 280, L = 40, R = 8, Tp = 12, Bt = 26;
  const max = share ? 1 : Math.ceil(Math.max(...years.map((y) => y.outlays_total)) / 1e12) * 1e12;
  const slot = (W - L - R) / years.length;
  const bw = Math.max(8, slot - 8);
  const y = (v) => Tp + (H - Tp - Bt) * (1 - v / max);
  const ticks = share ? [0, 0.25, 0.5, 0.75, 1] : Array.from({ length: max / 1e12 + 1 }, (_, t) => t * 1e12).filter((t, i) => i % 2 === 0);
  const cur = years[sel];
  const curParts = grouped(cur);
  return (
    <div className="stack">
      <div className="seg-toggle" role="group" aria-label={tr("Show as", "Mostrar como")}>
        <button type="button" aria-pressed={!share} onClick={() => setShare(false)}>{tr("Dollars", "Dólares")}</button>
        <button type="button" aria-pressed={share} onClick={() => setShare(true)}>{tr("Share of spending", "Parte del gasto")}</button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={tr("Spending by year, stacked by category, with a mark at receipts; the table below has the figures.", "Gasto por año, apilado por categoría, con una marca en los ingresos; la tabla de abajo tiene las cifras.")}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">{share ? `${Math.round(t * 100)}%` : `$${t / 1e12}T`}</text>
          </g>
        ))}
        {years.map((yr, i) => {
          const x = L + i * slot + (slot - bw) / 2;
          const total = yr.outlays_total;
          let acc = 0;
          const scale = share ? 1 / total : 1;
          const rec = yr.receipts_total * scale;
          return (
            <g key={yr.fiscal_year} className={i === sel ? "bar sel" : "bar"} onMouseEnter={() => setSel(i)} onClick={() => setSel(i)}>
              <rect x={L + i * slot} y={Tp} width={slot} height={H - Tp - Bt} fill="transparent" />
              {grouped(yr).map((p) => {
                const v = Math.max(0, p.amount) * scale;
                const y0 = y(acc), y1 = y(acc + v);
                acc += v;
                return <rect key={p.key} x={x} y={y1} width={bw} height={Math.max(0, y0 - y1 - 2)} fill={p.color} />;
              })}
              <line x1={x - 3} x2={x + bw + 3} y1={y(rec)} y2={y(rec)} stroke="var(--bg)" strokeWidth="5" />
              <line x1={x - 3} x2={x + bw + 3} y1={y(rec)} y2={y(rec)} stroke="var(--text)" strokeWidth="2.5" />
              {((years.length - 1 - i) % 3 === 0) && <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="axis">{yr.fiscal_year}</text>}
            </g>
          );
        })}
      </svg>
      <ul className="stack-legend fine">
        {[...GROUPS, { key: "Everything else", color: OTHER }].slice().reverse().map((g) => (
          <li key={g.key}><span className="swatch" style={{ background: g.color }} />{groupName(g.key)}</li>
        ))}
        <li><span className="swatch marker" />{tr("What came in (receipts). Spending above this line is the deficit.", "Lo que entró (ingresos). El gasto por encima de esta línea es el déficit.")}</li>
      </ul>
      <div className="stack-detail" aria-live="polite">
        <p><strong>{tr(`FY${cur.fiscal_year}`, `AF${cur.fiscal_year}`)}</strong>{tr(" · tap or point at a year", " · toque o señale un año")}</p>
        <table>
          <tbody>
            {curParts.slice().reverse().map((p) => (
              <tr key={p.key}><td><span className="swatch" style={{ background: p.color }} />{groupName(p.key)}</td><td>{B(p.amount)}</td><td>{per100(p.amount, cur.outlays_total)}%</td></tr>
            ))}
            <tr className="total"><td>{tr("Spending (outlays)", "Gasto (egresos)")}</td><td>{B(cur.outlays_total)}</td><td></td></tr>
            <tr><td>{tr("What came in (receipts)", "Lo que entró (ingresos)")}</td><td>{B(cur.receipts_total)}</td><td></td></tr>
            <tr><td>{cur.deficit >= 0 ? tr("Deficit", "Déficit") : tr("Surplus", "Superávit")}</td><td>{B(Math.abs(cur.deficit))}</td><td></td></tr>
          </tbody>
        </table>
        <p className="fine">
          {tr("Everything else is the other 13 budget functions, net of offsetting receipts, such as veterans' benefits, transportation and education. Dollars are not adjusted for inflation.",
            "Todo lo demás son las otras 13 funciones presupuestarias, descontando los ingresos compensatorios, como beneficios para veteranos, transporte y educación. Los dólares no están ajustados por inflación.")}
        </p>
      </div>
    </div>
  );
}

// A small trend line under a headline figure: one series, no judgment colors, the chosen year dotted.
function Spark({ values, at, label }) {
  const W = 120, H = 28, P = 3;
  const lo = Math.min(0, ...values), hi = Math.max(...values);
  const x = (i) => P + (i * (W - 2 * P)) / (values.length - 1);
  const y = (v) => H - P - ((v - lo) / (hi - lo || 1)) * (H - 2 * P);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <path d={values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")} fill="none" stroke="var(--muted)" strokeWidth="1.5" />
      {at >= 0 && <circle cx={x(at)} cy={y(values[at])} r="3" fill="var(--text)" />}
    </svg>
  );
}

// Receipts and outlays by fiscal year: two lines, one axis, crosshair tooltip.
function Trend({ years }) {
  const [hover, setHover] = useState(null);
  const W = 480, H = 240, L = 40, R = 64, Tp = 12, Bt = 26;
  const max = Math.ceil(Math.max(...years.map((y) => y.outlays_total)) / 1e12);
  const x = (i) => L + (i * (W - L - R)) / (years.length - 1);
  const y = (v) => Tp + (H - Tp - Bt) * (1 - v / (max * 1e12));
  const line = (k) => years.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join("");
  const h = hover != null ? years[hover] : null;
  return (
    <div className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={tr("Receipts and outlays by fiscal year; the table below has the figures.", "Ingresos y gastos por año fiscal; la tabla de abajo tiene las cifras.")}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(years.length - 1, Math.round(((px - L) / (W - L - R)) * (years.length - 1)))));
        }}>
        {Array.from({ length: max + 1 }, (_, t) => t % 2 === 0 && (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t * 1e12)} y2={y(t * 1e12)} stroke="var(--border)" />
            <text x={L - 6} y={y(t * 1e12) + 4} textAnchor="end" className="axis">${t}T</text>
          </g>
        ))}
        {years.map((d, i) => ((years.length - 1 - i) % 3 === 0) && (
          <text key={d.fiscal_year} x={x(i)} y={H - 8} textAnchor="middle" className="axis">{d.fiscal_year}</text>
        ))}
        {h && <line x1={x(hover)} x2={x(hover)} y1={Tp} y2={H - Bt} stroke="var(--border-strong)" />}
        <path d={line("receipts_total")} fill="none" stroke={IN} strokeWidth="2" />
        <path d={line("outlays_total")} fill="none" stroke={OUT} strokeWidth="2" />
        {h && [["receipts_total", IN], ["outlays_total", OUT]].map(([k, c]) => (
          <circle key={k} cx={x(hover)} cy={y(h[k])} r="4" fill={c} stroke="var(--bg)" strokeWidth="2" />
        ))}
        <text x={W - R + 6} y={y(years.at(-1).outlays_total) + 4} className="axis">{tr("Outlays", "Gastos")}</text>
        <text x={W - R + 6} y={y(years.at(-1).receipts_total) + 4} className="axis">{tr("Receipts", "Ingresos")}</text>
      </svg>
      <p className="legend fine">
        <span className="swatch" style={{ background: IN }} /> {tr("Receipts", "Ingresos")}
        <span className="swatch" style={{ background: OUT }} /> {tr("Outlays", "Gastos")}
      </p>
      <p className="trend-tip fine" aria-live="polite">
        {h ? tr(`FY${h.fiscal_year}: receipts ${T(h.receipts_total)}, outlays ${T(h.outlays_total)}, difference ${T(h.deficit)}`,
          `AF${h.fiscal_year}: ingresos ${T(h.receipts_total)}, gastos ${T(h.outlays_total)}, diferencia ${T(h.deficit)}`)
          : tr("Point at a year to see its figures.", "Señale un año para ver sus cifras.")}
      </p>
    </div>
  );
}

export default function Budget() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [fy, setFy] = useState(null);
  useEffect(() => {
    fetch("/data/budget.json").then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => { setData(d); setFy(d.years.at(-1).fiscal_year); }).catch(() => setErr(true));
  }, []);
  const year = useMemo(() => data?.years.find((y) => y.fiscal_year === fy), [data, fy]);

  if (err) return <main className="page"><p className="notice">{tr("Budget figures didn't load. Reload the page to try again.", "Las cifras del presupuesto no se cargaron. Vuelva a cargar la página para intentarlo de nuevo.")}</p></main>;
  if (!data || !year) return <main className="page"><p>{tr("Loading…", "Cargando…")}</p></main>;
  const { current, debt } = data;
  const debtFy = debt.fiscal_years.find((d) => d.fiscal_year === fy);
  const yi = data.years.findIndex((y) => y.fiscal_year === fy);
  const sparkLabel = tr("Trend by fiscal year; the table under Year by year has the figures.", "Tendencia por año fiscal; la tabla en Año por año tiene las cifras.");

  return (
    <main className="page wide budget">
      <h1>{tr("Federal budget", "Presupuesto federal")}</h1>
      <p className="lede">
        {tr("Congress sets taxes and approves spending; the Treasury reports what actually came in and went out. These figures are the Treasury's, for each fiscal year (October through September).",
          "El Congreso fija los impuestos y aprueba el gasto; el Tesoro informa lo que realmente entró y salió. Estas cifras son del Tesoro, para cada año fiscal (de octubre a septiembre).")}
      </p>

      <label className="fy-pick">
        {tr("Fiscal year ", "Año fiscal ")}
        <select value={fy} onChange={(e) => setFy(Number(e.target.value))}>
          {[...data.years].reverse().map((y) => <option key={y.fiscal_year} value={y.fiscal_year}>{y.fiscal_year} ({fyRange(y.fiscal_year)})</option>)}
        </select>
      </label>

      <div className="budget-figures">
        <div><span className="fig">{T(year.receipts_total)}</span><span>{tr("came in (receipts)", "entró (ingresos)")}</span><Spark values={data.years.map((y) => y.receipts_total)} at={yi} label={sparkLabel} /></div>
        <div><span className="fig">{T(year.outlays_total)}</span><span>{tr("went out (outlays)", "salió (gastos)")}</span><Spark values={data.years.map((y) => y.outlays_total)} at={yi} label={sparkLabel} /></div>
        <div><span className="fig">{T(Math.abs(year.deficit))}</span><span>{year.deficit >= 0 ? tr("more spent than collected (deficit)", "más gastado que recaudado (déficit)") : tr("more collected than spent (surplus)", "más recaudado que gastado (superávit)")}</span><Spark values={data.years.map((y) => y.deficit)} at={yi} label={sparkLabel} /></div>
        {debtFy && <div><span className="fig">{T(debtFy.total)}</span><span>{tr(`total debt on ${date(debtFy.record_date)}`, `deuda total al ${date(debtFy.record_date)}`)}</span><Spark values={debt.fiscal_years.map((d) => d.total)} at={debt.fiscal_years.findIndex((d) => d.fiscal_year === fy)} label={sparkLabel} /></div>}
      </div>
      <p className="fine spark-note">{tr(`Small lines: FY${data.years[0].fiscal_year} to FY${data.years.at(-1).fiscal_year}; the dot is the year chosen. "Year by year" below has the full chart.`, `Líneas pequeñas: AF${data.years[0].fiscal_year} a AF${data.years.at(-1).fiscal_year}; el punto es el año elegido. "Año por año", más abajo, tiene la gráfica completa.`)}</p>

      <div className="budget-two">
      <section>
        <h2>{tr("Where the money went", "En qué se gastó")}</h2>
        <p className="fine">{tr("Outlays by budget function, the categories the government uses to group spending by purpose.", "Gastos por función presupuestaria, las categorías que el gobierno usa para agrupar el gasto según su propósito.")}</p>
        <Bars rows={year.outlays} perHundred total={year.outlays_total} />
      </section>

      <section>
        <h2>{tr("Where the money came from", "De dónde vino el dinero")}</h2>
        <Bars rows={year.receipts} perHundred total={year.receipts_total} />
        <p className="fine">{tr("Social insurance and retirement receipts are mostly payroll taxes for Social Security and Medicare.", "Las contribuciones al seguro social y la jubilación son sobre todo impuestos sobre la nómina para el Seguro Social y Medicare.")}</p>
      </section>

      </div>

      <section>
        <h2>{tr("Year by year", "Año por año")}</h2>
        <Stacked years={data.years} />
        <h3>{tr("Receipts and spending", "Ingresos y gasto")}</h3>
        <Trend years={data.years} />
        <details>
          <summary>{tr("Show as a table", "Ver como tabla")}</summary>
          <table>
            <thead><tr><th>{tr("Fiscal year", "Año fiscal")}</th><th>{tr("Receipts", "Ingresos")}</th><th>{tr("Outlays", "Gastos")}</th><th>{tr("Receipts minus outlays", "Ingresos menos gastos")}</th><th>{tr("Total debt, Sep 30", "Deuda total, 30 sep.")}</th><th>{tr("Held by the public", "En manos del público")}</th></tr></thead>
            <tbody>
              {[...data.years].reverse().map((y) => {
                const d = debt.fiscal_years.find((x) => x.fiscal_year === y.fiscal_year);
                return <tr key={y.fiscal_year}><td>{y.fiscal_year}</td><td>{B(y.receipts_total)}</td><td>{B(y.outlays_total)}</td><td>{B(-y.deficit)}</td><td>{d ? B(d.total) : "—"}</td><td>{d ? B(d.held_by_public) : "—"}</td></tr>;
              })}
            </tbody>
          </table>
        </details>
      </section>

      <section>
        <h2>{tr("Debt", "Deuda")}</h2>
        <p>
          {tr(`Total public debt outstanding on ${date(debt.latest.record_date)}: ${T(debt.latest.total)}. Of that, ${T(debt.latest.held_by_public)} is held by the public (investors, including foreign governments and the Federal Reserve) and ${T(debt.latest.intragovernmental)} is owed to government accounts such as the Social Security trust funds.`,
            `Deuda pública total al ${date(debt.latest.record_date)}: ${T(debt.latest.total)}. De esa cantidad, ${T(debt.latest.held_by_public)} está en manos del público (inversionistas, incluidos gobiernos extranjeros y la Reserva Federal) y ${T(debt.latest.intragovernmental)} se debe a cuentas del gobierno como los fondos fiduciarios del Seguro Social.`)}
        </p>
      </section>

      {current && (
        <section>
          <h2>{tr(`This fiscal year so far (FY${current.fiscal_year})`, `Este año fiscal hasta ahora (AF${current.fiscal_year})`)}</h2>
          <p>
            {tr(`Through ${date(current.record_date)}: receipts ${B(current.receipts_total)}, outlays ${B(current.outlays_total)}.`,
              `Hasta el ${date(current.record_date)}: ingresos ${B(current.receipts_total)}, gastos ${B(current.outlays_total)}.`)}
            {current.prior_same_period && tr(` Same months a year earlier: receipts ${B(current.prior_same_period.receipts_total)}, outlays ${B(current.prior_same_period.outlays_total)}.`,
              ` Los mismos meses un año antes: ingresos ${B(current.prior_same_period.receipts_total)}, gastos ${B(current.prior_same_period.outlays_total)}.`)}
          </p>
          <p className="fine">{tr("Monthly figures swing with tax deadlines and payment timing, so part of a year doesn't predict the whole year.", "Las cifras mensuales varían según las fechas de impuestos y de pagos, así que una parte del año no predice el año completo.")}</p>
        </section>
      )}

      <p className="source fine">
        {tr("Sources: ", "Fuentes: ")}<a href={data.sources.mts}>{tr("Monthly Treasury Statement, Table 9", "Estado Mensual del Tesoro, Tabla 9")}</a>; <a href={data.sources.debt}>Debt to the Penny</a>{tr(", Bureau of the Fiscal Service. Updated ", ", Oficina del Servicio Fiscal. Actualizado el ")}{date(data.built_at.slice(0, 10))}. <Link to="/methods#budget">{tr("About this data", "Sobre estos datos")}</Link>.
      </p>
    </main>
  );
}
