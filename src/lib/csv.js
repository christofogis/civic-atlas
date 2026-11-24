// CSV for spreadsheets. columns: [[header, row => value], ...]
const cell = (v) => {
  const s = v == null ? "" : String(v);
  // Quote when needed; prefix formula-like text so spreadsheets don't execute it.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(rows, columns) {
  const lines = [columns.map(([h]) => cell(h)).join(",")];
  for (const r of rows) lines.push(columns.map(([, f]) => cell(f(r))).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";   // BOM so Excel reads UTF-8 names correctly
}

