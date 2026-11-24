// Parsers for STOCK Act Periodic Transaction Reports (PTRs).
//   House: text of an electronically filed PTR PDF, from `pdftotext -layout`.
//   Senate: HTML of an electronic PTR page on efdsearch.senate.gov.
// Scanned paper filings have no text; callers record the filing and link to the original.
// Values are kept as filed (asset names, amount ranges); only codes are spelled out.

const OWNER = { SP: "spouse", JT: "joint", DC: "dependent child", "": "self",
  Self: "self", Spouse: "spouse", Joint: "joint", Child: "dependent child", "Dependent Child": "dependent child" };
const TYPE = { P: "purchase", S: "sale", "S (partial)": "sale (partial)", E: "exchange",
  Purchase: "purchase", Sale: "sale", "Sale (Full)": "sale", "Sale (Partial)": "sale (partial)", Exchange: "exchange" };

// "$1,001 - $15,000" -> {min: 1001, max: 15000}; "Over $50,000,000" -> {min: 50000001, max: null}
export function parseAmount(text) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  const nums = (t.match(/\$[\d,]+/g) ?? []).map((n) => parseInt(n.replace(/[$,]/g, ""), 10));
  if (/^over/i.test(t) || /over \$/i.test(t)) return { text: t, min: nums[0] != null ? nums[0] + 1 : null, max: null };
  if (/(-|over)\s*$/i.test(t)) return { text: t, min: nums[0] ?? null, max: null }; // cut off: bound unknown
  return { text: t, min: nums[0] ?? null, max: nums[1] ?? nums[0] ?? null };
}

const isoDate = (mdy) => {
  const m = String(mdy ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
};
export { isoDate };

// A trade line: [owner] asset-start type txn-date notif-date amount(-start)
const HOUSE_LINE = /^\s*(?:(SP|JT|DC)\s{2,})?(.*?)\s+(S \(partial\)|P|S|E)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s*$/;
// Lines after a trade's own text (filing status, description, sub-owner, footers) end it.
const STOP = /^\s*(F\s+S\s*:|D\s+:|S\s+O\s*:|C\s+:|\* For the complete|I\s+P\s+O|I\s+V\s+D|Filing ID|Digitally Signed)/;
// The column header repeats at each page break, sometimes in the middle of a trade.
const PAGE_HEADER = /^\s*(ID\s+Owner|Type\s+Date|\$200\?\s*$|Gains >\s*$)/;

export function parseHousePtrText(text) {
  const lines = String(text).split("\n");
  const rows = [];
  let cur = null;
  const finish = () => {
    if (!cur) return;
    const asset = cur.asset.replace(/\s+/g, " ").trim();
    const ticker = (asset.match(/\(([A-Z][A-Z0-9.\-]{0,9})\)(?=[^()]*$)/) ?? [])[1] ?? null;
    const code = (asset.match(/\[([A-Z]{2,3})\]\s*$/) ?? [])[1] ?? null;
    const amount = parseAmount(cur.amount);
    rows.push({
      owner: OWNER[cur.owner ?? ""] ?? cur.owner,
      asset_name: asset.replace(/\s*\[[A-Z]{2,3}\]\s*$/, ""),
      ticker,
      asset_type: code,
      transaction_type: TYPE[cur.type] ?? cur.type,
      transaction_date: isoDate(cur.txn),
      notification_date: isoDate(cur.notif),
      amount_text: amount.text, amount_min: amount.min, amount_max: amount.max,
    });
    cur = null;
  };
  for (const line of lines) {
    const m = line.match(HOUSE_LINE);
    if (m && /\$|over/i.test(m[6])) {
      finish();
      cur = { owner: m[1], asset: m[2], type: m[3], txn: m[4], notif: m[5], amount: m[6] };
      continue;
    }
    if (!cur) continue;
    if (STOP.test(line)) { finish(); continue; }
    if (PAGE_HEADER.test(line) || !line.trim()) continue;
    // Continuation: left part extends the asset name; a trailing "$..." finishes a wrapped amount.
    const parts = line.trim().split(/\s{3,}/);
    const tail = parts[parts.length - 1];
    // A wrapped amount ends in "-" (e.g. "$100,001 -") or "Over" ("Spouse/DC Over").
    if (/^\$[\d,]+$/.test(tail) && /(-|over)\s*$/i.test(cur.amount)) {
      cur.amount += " " + tail;
      parts.pop();
    }
    if (parts.length && !/\[[A-Z]{2,3}\]\s*$/.test(cur.asset)) cur.asset += " " + parts.join(" ");
  }
  finish();
  return rows;
}

const strip = (h) => String(h ?? "").replace(/<div class="text-muted">[\s\S]*?<\/div>/g, (d) => " — " + d.replace(/<[^>]+>/g, " "))
  .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">").replace(/&#35;/g, "#").replace(/\s+/g, " ").trim();

export function parseSenatePtrHtml(html) {
  const table = String(html).match(/<table[^>]*>[\s\S]*?<\/table>/);
  if (!table) return null; // not an electronic PTR (e.g. a scanned paper filing)
  const body = table[0].split(/<tbody>/)[1] ?? "";
  const rows = [];
  for (const tr of body.match(/<tr>[\s\S]*?<\/tr>/g) ?? []) {
    const td = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) ?? []).map(strip);
    if (td.length < 8) continue;
    const [, date, owner, ticker, asset, assetType, type, amountText, comment] = td;
    const amount = parseAmount(amountText);
    rows.push({
      owner: OWNER[owner] ?? owner.toLowerCase(),
      asset_name: asset.replace(/\s+—\s+$/, ""),
      ticker: ticker && ticker !== "--" ? ticker : null,
      asset_type: assetType || null,
      transaction_type: TYPE[type] ?? type.toLowerCase(),
      transaction_date: isoDate(date),
      notification_date: null,
      amount_text: amount.text, amount_min: amount.min, amount_max: amount.max,
      comment: comment && comment !== "--" ? comment : null,
    });
  }
  return rows;
}
