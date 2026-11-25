import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { NotesList, NotesProvider, Ref } from "../components/Notes.jsx";

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

const IN = "var(--chart-in)";   // receipts; chart colors are CSS tokens with light and dark steps (styles.css)
const OUT = "var(--chart-out)";  // outlays
const BAR = "var(--accent)";   // follows the light or dark theme

const sign = (n) => (n < 0 ? "−" : "");
const T = (n) => `${sign(n)}$${(Math.abs(n) / 1e12).toFixed(2)} ${tr("trillion", "billones")}`;
const B = (n) => (Math.abs(n) >= 1e12 ? T(n) : `${sign(n)}$${Math.round(Math.abs(n) / 1e9).toLocaleString()} ${tr("billion", "mil millones")}`);
const per100 = (part, total) => { const v = (100 * part) / total; return v.toFixed(v < 1 ? 2 : v < 10 ? 1 : 0); };
const fyRange = (fy) => tr(`Oct ${fy - 1} – Sep ${fy}`, `oct. ${fy - 1} – sep. ${fy}`);

// Horizontal bars, one series, sorted largest first. Shares are of the positive total.
function Bars({ rows, perHundred, total, color = BAR }) {
  const pos = rows.filter((r) => r.amount > 0).sort((a, z) => z.amount - a.amount);
  const neg = rows.filter((r) => r.amount < 0);
  const max = pos[0]?.amount ?? 1;
  return (
    <>
      <ul className="hbars">
        {pos.map((r) => (
          <li key={r.label}>
            <span className="hbar-label"><Label en={r.label} /></span>
            <span className="hbar-track"><span className="hbar" style={{ width: `${(100 * r.amount) / max}%`, background: color }} /></span>
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
  { key: "Social Security", color: "var(--chart-1)" },
  { key: "Medicare", color: "var(--chart-2)" },
  { key: "Health", color: "var(--chart-3)" },
  { key: "Net Interest", color: "var(--chart-4)" },
  { key: "Income Security", color: "var(--chart-5)" },
  { key: "National Defense", color: "var(--chart-6)" },
];
const OTHER = "var(--chart-other)";
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
                return <rect key={p.key} x={x} y={y1} width={bw} height={Math.max(0, y0 - y1 - 2)} style={{ fill: p.color }} />;
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
          {tr("Dollars are not adjusted for inflation.", "Los dólares no están ajustados por inflación.")}<Ref id="grouping" />
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
        <path d={line("receipts_total")} fill="none" style={{ stroke: IN }} strokeWidth="2" />
        <path d={line("outlays_total")} fill="none" style={{ stroke: OUT }} strokeWidth="2" />
        {h && [["receipts_total", IN], ["outlays_total", OUT]].map(([k, c]) => (
          <circle key={k} cx={x(hover)} cy={y(h[k])} r="4" style={{ fill: c, stroke: "var(--bg)" }} strokeWidth="2" />
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

// Surplus or deficit by fiscal year since 1940 (OMB Historical Tables, Table 1.3), one bar a year
// from a zero line: below it, more went out than came in (deficit); above it, a surplus. Shown as
// a share of the economy (GDP), in dollars of the day, or adjusted for inflation; and over the
// last 20 or 40 years, or every year since 1940.
function History({ data }) {
  const [unit, setUnit] = useState("gdp");
  const [span, setSpan] = useState(40);
  const [hover, setHover] = useState(null);
  const all = data.years;
  const years = span ? all.slice(-span) : all;
  const key = { gdp: "surplus_gdp", dollars: "surplus", real: "surplus_const" }[unit];
  const W = 960, H = 300, L = 56, R = 8, Tp = 12, Bt = 26;
  const vals = years.map((d) => d[key]);
  const hi = Math.max(0, ...vals), lo = Math.min(0, ...vals);
  // Round the scale to tidy steps.
  const step = unit === "gdp" ? (lo < -15 ? 10 : lo < -6 ? 4 : 2) : (lo < -2000 ? 1000 : lo < -800 ? 500 : 200);
  const top = Math.ceil(hi / step) * step, bot = Math.floor(lo / step) * step;
  const y = (v) => Tp + ((top - v) / (top - bot || 1)) * (H - Tp - Bt);
  const slot = (W - L - R) / years.length;
  const bw = Math.max(2, slot - (slot > 10 ? 3 : 1));
  const ticks = []; for (let t = bot; t <= top + 1e-9; t += step) ticks.push(t);
  const every = years.length > 60 ? 10 : years.length > 30 ? 5 : 2;
  const h = hover != null ? years[hover] : null;
  const unitLabel = { gdp: tr("Share of the economy (GDP)", "Parte de la economía (PIB)"), dollars: tr("Dollars", "Dólares"), real: tr(`Inflation-adjusted (${data.constant_year} dollars)`, `Ajustado por inflación (dólares de ${data.constant_year})`) };
  return (
    <div className="history">
      <div className="history-controls">
        <div className="seg-toggle" role="group" aria-label={tr("Show as", "Mostrar como")}>
          {["gdp", "dollars", "real"].map((u) => <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>{unitLabel[u]}</button>)}
        </div>
        <div className="seg-toggle" role="group" aria-label={tr("Years", "Años")}>
          {[[20, tr("20 years", "20 años")], [40, tr("40 years", "40 años")], [0, tr(`Since ${all[0].fiscal_year}`, `Desde ${all[0].fiscal_year}`)]].map(([n, label]) => (
            <button key={n} type="button" aria-pressed={span === n} onClick={() => { setSpan(n); setHover(null); }}>{label}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={tr("Surplus or deficit by fiscal year; bars below the zero line are deficits. The table below has the figures.", "Superávit o déficit por año fiscal; las barras debajo de la línea cero son déficits. La tabla de abajo tiene las cifras.")}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(years.length - 1, Math.floor((px - L) / slot))));
        }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--text)" : "var(--border)"} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="axis">{unit === "gdp" ? `${t}%` : Math.abs(t) >= 1000 ? `${t / 1000}T` : `${t}B`}</text>
          </g>
        ))}
        {years.map((d, i) => {
          const v = d[key], x = L + i * slot + (slot - bw) / 2;
          return (
            <g key={d.fiscal_year}>
              <rect x={x} width={bw} y={Math.min(y(v), y(0))} height={Math.max(1, Math.abs(y(v) - y(0)))}
                style={{ fill: v < 0 ? OUT : IN, opacity: hover == null || hover === i ? 1 : 0.55 }} rx={bw > 6 ? 2 : 0} />
              {d.fiscal_year % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="axis">{d.fiscal_year}</text>}
            </g>
          );
        })}
      </svg>
      <p className="legend fine">
        <span className="swatch" style={{ background: OUT }} /> {tr("Deficit: more went out than came in (below the line)", "Déficit: salió más de lo que entró (debajo de la línea)")}
        <span className="swatch" style={{ background: IN }} /> {tr("Surplus (above the line)", "Superávit (encima de la línea)")}
      </p>
      <p className="trend-tip fine" aria-live="polite">
        {h ? tr(`FY${h.fiscal_year}: ${h.surplus < 0 ? "deficit" : "surplus"} of ${B(Math.abs(h.surplus) * 1e9)}, ${Math.abs(h.surplus_gdp).toFixed(1)}% of GDP (${B(Math.abs(h.surplus_const) * 1e9)} in ${data.constant_year} dollars). Receipts ${B(h.receipts * 1e9)}, outlays ${B(h.outlays * 1e9)}.`,
          `AF${h.fiscal_year}: ${h.surplus < 0 ? "déficit" : "superávit"} de ${B(Math.abs(h.surplus) * 1e9)}, ${Math.abs(h.surplus_gdp).toFixed(1)}% del PIB (${B(Math.abs(h.surplus_const) * 1e9)} en dólares de ${data.constant_year}). Ingresos ${B(h.receipts * 1e9)}, gastos ${B(h.outlays * 1e9)}.`)
          : tr("Point at a year to see its figures.", "Señale un año para ver sus cifras.")}
      </p>
      <details>
        <summary>{tr("Show as a table", "Ver como tabla")}</summary>
        <div className="table-scroll">
          <table>
            <thead><tr><th>{tr("Fiscal year", "Año fiscal")}</th><th>{tr("Receipts", "Ingresos")}</th><th>{tr("Outlays", "Gastos")}</th><th>{tr("Surplus or deficit (−)", "Superávit o déficit (−)")}</th><th>{tr("% of GDP", "% del PIB")}</th><th>{tr(`In ${data.constant_year} dollars`, `En dólares de ${data.constant_year}`)}</th></tr></thead>
            <tbody>
              {[...all].reverse().map((d) => (
                <tr key={d.fiscal_year}><td>{d.fiscal_year}</td><td>{B(d.receipts * 1e9)}</td><td>{B(d.outlays * 1e9)}</td><td>{B(d.surplus * 1e9)}</td><td>{d.surplus_gdp.toFixed(1)}%</td><td>{B(d.surplus_const * 1e9)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export default function Budget() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const [fy, setFy] = useState(null);
  const [history, setHistory] = useState(null);
  useEffect(() => {
    fetch("/data/budget-history.json").then((r) => (r.ok ? r.json() : null)).then(setHistory).catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/data/budget.json").then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => { setData(d); setFy(d.years.at(-1).fiscal_year); }).catch(() => setErr(true));
  }, []);
  const year = useMemo(() => data?.years.find((y) => y.fiscal_year === fy), [data, fy]);

  if (err) return <main className="page"><p className="notice">{tr("Budget figures didn't load. Reload the page to try again.", "Las cifras del presupuesto no se cargaron. Vuelva a cargar la página para intentarlo de nuevo.")}</p></main>;
  if (!data || !year) return <main className="page"><p>{tr("Loading…", "Cargando…")}</p></main>;
  const { current, debt } = data;
  const debtFy = debt.fiscal_years.find((d) => d.fiscal_year === fy);
  const yi = data.years.findIndex((y) => y.fiscal_year === fy);
  const first = data.years[0].fiscal_year, last = data.years.at(-1).fiscal_year;
  const notes = [
    { id: "mts", text: <>{tr("Receipts and outlays: ", "Ingresos y gastos: ")}<a href={data.sources.mts}>{tr("Monthly Treasury Statement, Table 9", "Estado Mensual del Tesoro, Tabla 9")}</a>{tr(", Bureau of the Fiscal Service. Each fiscal year is the September statement's year-to-date total. Rebuilt monthly; last updated ", ", Oficina del Servicio Fiscal. Cada año fiscal es el total acumulado del estado de septiembre. Se actualiza cada mes; última actualización: ")}{date(data.built_at.slice(0, 10))}.</> },
    { id: "spark", text: tr(`The small lines under each figure run from FY${first} to FY${last}; the dot marks the year chosen above. "Year by year" has the full chart and a table.`, `Las líneas pequeñas bajo cada cifra van del AF${first} al AF${last}; el punto marca el año elegido arriba. "Año por año" tiene la gráfica completa y una tabla.`) },
    { id: "debt", text: <>{tr("Debt: ", "Deuda: ")}<a href={data.sources.debt}>Debt to the Penny</a>{tr(", Bureau of the Fiscal Service: total public debt outstanding on the last business day of each fiscal year, and on the latest day published. Debt held by the public is owed to investors, including foreign governments and the Federal Reserve; intragovernmental holdings are owed to government accounts such as the Social Security trust funds.", ", Oficina del Servicio Fiscal: deuda pública total el último día hábil de cada año fiscal y el día más reciente publicado. La deuda en manos del público se debe a inversionistas, incluidos gobiernos extranjeros y la Reserva Federal; las tenencias intragubernamentales se deben a cuentas del gobierno como los fondos fiduciarios del Seguro Social.")}</> },
    { id: "functions", text: tr("Outlays are grouped by budget function, the categories the government uses to group spending by purpose. Category names are the Treasury's own. Outlays are money actually paid out, which differs from what Congress appropriates in a given year.", "Los gastos se agrupan por función presupuestaria, las categorías que el gobierno usa para agrupar el gasto según su propósito. Los nombres de las categorías son del Tesoro. Los gastos son el dinero realmente pagado, que difiere de lo que el Congreso asigna en un año dado.") },
    { id: "payroll", text: tr("Social insurance and retirement receipts are mostly payroll taxes for Social Security and Medicare; their parts are listed under that row.", "Las contribuciones al seguro social y la jubilación son sobre todo impuestos sobre la nómina para el Seguro Social y Medicare; sus partes aparecen bajo esa fila.") },
    history && { id: "omb", text: <>{tr("Since 1940: ", "Desde 1940: ")}<a href={history.source_url}>{tr("Office of Management and Budget, Historical Tables, Table 1.3", "Oficina de Administración y Presupuesto, Tablas Históricas, Tabla 1.3")}</a>{tr(`, actual years only (OMB's estimates for later years are left out). Inflation-adjusted figures are OMB's, in ${history.constant_year} dollars. OMB's totals can differ slightly from the Treasury figures above, which are updated monthly; FY${history.years.at(-1).fiscal_year + 1} is added here when OMB publishes its actual figure.`, `, solo años reales (se omiten las estimaciones de la OMB para años posteriores). Las cifras ajustadas por inflación son de la OMB, en dólares de ${history.constant_year}. Los totales de la OMB pueden diferir un poco de las cifras del Tesoro de arriba, que se actualizan cada mes; el AF${history.years.at(-1).fiscal_year + 1} se agregará aquí cuando la OMB publique su cifra real.`)}</> },
    { id: "grouping", text: <>{tr("The chart groups spending into the six budget functions that were largest in most years since 2015, and everything else: the other 13 functions, net of offsetting receipts, such as veterans' benefits, transportation and education. The line marks total receipts. ", "La gráfica agrupa el gasto en las seis funciones presupuestarias más grandes en la mayoría de los años desde 2015, y todo lo demás: las otras 13 funciones, descontando los ingresos compensatorios, como beneficios para veteranos, transporte y educación. La línea marca los ingresos totales. ")}<Link to="/methods#budget">{tr("How this page is built", "Cómo se construye esta página")}</Link>.</> },
  ];
  const sparkLabel = tr("Trend by fiscal year; the table under Year by year has the figures.", "Tendencia por año fiscal; la tabla en Año por año tiene las cifras.");

  return (
    <NotesProvider notes={notes}>
    <main className="page wide budget">
      <h1>{tr("Federal budget", "Presupuesto federal")}</h1>
      <p className="lede">
        {tr("Congress sets taxes and approves spending; the Treasury reports what actually came in and went out. These figures are the Treasury's, for each fiscal year (October through September).",
          "El Congreso fija los impuestos y aprueba el gasto; el Tesoro informa lo que realmente entró y salió. Estas cifras son del Tesoro, para cada año fiscal (de octubre a septiembre).")}<Ref id="mts" />
      </p>

      <label className="fy-pick">
        {tr("Fiscal year ", "Año fiscal ")}
        <select value={fy} onChange={(e) => setFy(Number(e.target.value))}>
          {[...data.years].reverse().map((y) => <option key={y.fiscal_year} value={y.fiscal_year}>{y.fiscal_year} ({fyRange(y.fiscal_year)})</option>)}
        </select>
      </label>

      <div className="budget-figures">
        <div><span className="fig">{T(year.receipts_total)}</span><span>{tr("came in (receipts)", "entró (ingresos)")}<Ref id="spark" /></span><Spark values={data.years.map((y) => y.receipts_total)} at={yi} label={sparkLabel} /></div>
        <div><span className="fig">{T(year.outlays_total)}</span><span>{tr("went out (outlays)", "salió (gastos)")}</span><Spark values={data.years.map((y) => y.outlays_total)} at={yi} label={sparkLabel} /></div>
        <div><span className="fig">{T(Math.abs(year.deficit))}</span><span>{year.deficit >= 0 ? tr("more spent than collected (deficit)", "más gastado que recaudado (déficit)") : tr("more collected than spent (surplus)", "más recaudado que gastado (superávit)")}</span><Spark values={data.years.map((y) => y.deficit)} at={yi} label={sparkLabel} /></div>
        {debtFy && <div><span className="fig">{T(debtFy.total)}</span><span>{tr(`total debt on ${date(debtFy.record_date)}`, `deuda total al ${date(debtFy.record_date)}`)}<Ref id="debt" /></span><Spark values={debt.fiscal_years.map((d) => d.total)} at={debt.fiscal_years.findIndex((d) => d.fiscal_year === fy)} label={sparkLabel} /></div>}
      </div>

      <div className="budget-two">
      <section>
        <h2>{tr("Where the money went", "En qué se gastó")}<Ref id="functions" /></h2>
        <Bars rows={year.outlays} perHundred total={year.outlays_total} color={OUT} />
      </section>

      <section>
        <h2>{tr("Where the money came from", "De dónde vino el dinero")}<Ref id="payroll" /></h2>
        <Bars rows={year.receipts} perHundred total={year.receipts_total} color={IN} />
      </section>

      </div>

      <section>
        <h2>{tr("Year by year", "Año por año")}</h2>
        <div className="budget-two">
          <div>
            <h3>{tr("Spending by category", "Gasto por categoría")}</h3>
            <Stacked years={data.years} />
          </div>
          <div>
            <h3>{tr("Receipts and spending", "Ingresos y gasto")}</h3>
            <Trend years={data.years} />
          </div>
        </div>
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

      {history && (
        <section>
          <h2>{tr(`Surplus or deficit since ${history.years[0].fiscal_year}`, `Superávit o déficit desde ${history.years[0].fiscal_year}`)}<Ref id="omb" /></h2>
          <History data={history} />
        </section>
      )}

      <div className="budget-two">
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
      </div>

      <NotesList />
    </main>
    </NotesProvider>
  );
}
