// Federal receipts, outlays, deficit and debt from the Treasury's Fiscal Data API (no key).
//
//   node scripts/data/budget.mjs        # writes public/data/budget.json
//
// Sources:
//   - Monthly Treasury Statement, Table 9: receipts by source and outlays by budget function,
//     fiscal-year totals (the September statement) and the current fiscal year to date.
//   - Debt to the Penny: total public debt outstanding, split into debt held by the public and
//     intragovernmental holdings, latest business day plus each fiscal year's last day.
// Figures are stored as published (dollars). Labels are Treasury's own.
import { writeFileSync, mkdirSync } from "node:fs";

const API = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service";
const FIRST_FY = 2015;

async function get(path, params) {
  const url = `${API}${path}?${new URLSearchParams(params)}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.ok) return res.json();
    if (attempt >= 4) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 3000 * attempt));
  }
}

async function all(path, params) {
  const rows = [];
  for (let page = 1; ; page++) {
    const d = await get(path, { ...params, "page[size]": "1000", "page[number]": String(page) });
    rows.push(...d.data);
    if (page >= (d.meta?.["total-pages"] ?? 1)) return rows;
  }
}

const num = (v) => (v == null || v === "null" || v === "" ? null : Number(v));

// One statement month of Table 9 -> { receipts: [...], outlays: [...], totals }.
function shape(rows) {
  const receipts = [], outlays = [];
  let receiptsTotal = null, outlaysTotal = null;
  const social = { label: "Social Insurance and Retirement Receipts", amount: 0, parts: [] };
  for (const r of [...rows].sort((a, z) => Number(a.line_code_nbr) - Number(z.line_code_nbr))) {
    const line = Number(r.line_code_nbr);
    const amt = num(r.current_fytd_rcpt_outly_amt);
    const label = r.classification_desc.replace(/:$/, "").trim();
    if (line === 120) receiptsTotal = amt;
    else if (line === 340) outlaysTotal = amt;
    else if ([50, 60, 70].includes(line)) { social.amount += amt ?? 0; social.parts.push({ label, amount: amt }); }
    else if (line === 40) receipts.push(social);
    else if (line > 10 && line < 120 && amt != null) receipts.push({ label, amount: amt });
    else if (line > 130 && line < 340 && amt != null) outlays.push({ label, amount: amt });
  }
  return {
    receipts, outlays,
    receipts_total: receiptsTotal, outlays_total: outlaysTotal,
    deficit: receiptsTotal != null && outlaysTotal != null ? outlaysTotal - receiptsTotal : null,
  };
}

const fyOf = (date) => { const [y, m] = date.split("-").map(Number); return m >= 10 ? y + 1 : y; };

async function main() {
  const t9 = await all("/v1/accounting/mts/mts_table_9", {
    filter: `record_date:gte:${FIRST_FY - 1}-10-01`,
    fields: "record_date,classification_desc,current_fytd_rcpt_outly_amt,line_code_nbr,sequence_level_nbr",
  });
  const byDate = new Map();
  for (const r of t9) (byDate.get(r.record_date) ?? byDate.set(r.record_date, []).get(r.record_date)).push(r);
  const dates = [...byDate.keys()].sort();
  const latest = dates.at(-1);

  const years = dates.filter((d) => d.endsWith("-09-30")).map((d) => ({ fiscal_year: fyOf(d), record_date: d, ...shape(byDate.get(d)) }));
  const current = latest.endsWith("-09-30") ? null : { fiscal_year: fyOf(latest), record_date: latest, ...shape(byDate.get(latest)) };
  // The same months of the previous fiscal year, for a like-for-like comparison.
  if (current) {
    const [y, m, d] = latest.split("-");
    const prior = byDate.get(`${Number(y) - 1}-${m}-${d}`) ?? [...byDate.entries()].find(([k]) => k.startsWith(`${Number(y) - 1}-${m}-`))?.[1];
    if (prior) {
      const p = shape(prior);
      current.prior_same_period = { receipts_total: p.receipts_total, outlays_total: p.outlays_total, deficit: p.deficit };
    }
  }

  const debtRows = await all("/v2/accounting/od/debt_to_penny", {
    filter: `record_date:gte:${FIRST_FY - 1}-09-01`,
    fields: "record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt",
    sort: "record_date",
  });
  const debtFy = new Map();
  for (const r of debtRows) {
    const [, m] = r.record_date.split("-").map(Number);
    if (m === 9) debtFy.set(fyOf(r.record_date), r); // last September business day wins (sorted)
  }
  const pick = (r) => r && ({ record_date: r.record_date, total: num(r.tot_pub_debt_out_amt), held_by_public: num(r.debt_held_public_amt), intragovernmental: num(r.intragov_hold_amt) });
  const debt = {
    latest: pick(debtRows.at(-1)),
    fiscal_years: [...debtFy].filter(([fy]) => fy >= FIRST_FY).map(([fiscal_year, r]) => ({ fiscal_year, ...pick(r) })),
  };

  for (const y of years) if (!y.receipts.length || !y.outlays.length) throw new Error(`FY${y.fiscal_year}: empty table`);
  if (!years.length) throw new Error("no fiscal-year statements");

  const out = {
    built_at: new Date().toISOString(),
    sources: {
      mts: "https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/summary-of-receipts-and-outlays-of-the-u-s-government",
      debt: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/",
    },
    years, current, debt,
  };
  mkdirSync("public/data", { recursive: true });
  writeFileSync("public/data/budget.json", JSON.stringify(out, null, 1) + "\n");
  const last = years.at(-1);
  console.log(`FY${years[0].fiscal_year}–FY${last.fiscal_year}; FY${last.fiscal_year}: receipts ${(last.receipts_total / 1e12).toFixed(2)}T, outlays ${(last.outlays_total / 1e12).toFixed(2)}T`);
  if (current) console.log(`current FY${current.fiscal_year} through ${current.record_date}`);
  console.log(`debt ${debt.latest.record_date}: ${(debt.latest.total / 1e12).toFixed(2)}T`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
