// "Download as spreadsheet": the rows on screen as a CSV file that Excel, Numbers and Google
// Sheets open. Built in the browser; nothing is sent anywhere.
// columns: [[header, row => value], ...]
import { toCsv } from "../lib/csv.js";

export default function DownloadCsv({ rows, columns, filename, note }) {
  if (!rows?.length) return null;
  const download = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${filename}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <p className="fine download">
      <button type="button" className="link fine" onClick={download}>Download {rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"} as a spreadsheet (CSV)</button>
      {note && <> · {note}</>}
    </p>
  );
}
