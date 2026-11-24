import { useState } from "react";
import { useLocation } from "react-router-dom";
import { tr } from "../lib/lang.js";

// "Report an error" link at the foot of every page. Sends the page address and the message
// only; no names or contact details.
export default function ReportError() {
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle");

  async function submit(e) {
    e.preventDefault();
    if (text.trim().length < 5) return;
    setStatus("sending");
    const { db } = await import("../lib/db.js"); // loaded only when someone sends a report
    const { error } = await db.rpc("submit_error_report", { page: `${pathname}${search}`, message: text.trim() });
    setStatus(error ? "error" : "sent");
    if (!error) setText("");
  }

  if (!open) return <button type="button" className="link fine" onClick={() => { setOpen(true); setStatus("idle"); }}>{tr("Report an error on this page", "Informar un error en esta página")}</button>;
  if (status === "sent") return <p className="fine">{tr("Thanks. Your report was sent with this page's address.", "Gracias. Su informe se envió con la dirección de esta página.")}</p>;
  return (
    <form onSubmit={submit} className="report">
      <label htmlFor="report-text" className="fine">{tr("What's wrong on this page? Please don't include personal information.", "¿Qué está mal en esta página? No incluya información personal.")}</label>
      <textarea id="report-text" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row-inline">
        <button type="submit" disabled={status === "sending" || text.trim().length < 5}>{status === "sending" ? tr("Sending…", "Enviando…") : tr("Send", "Enviar")}</button>
        <button type="button" className="link" onClick={() => setOpen(false)}>{tr("Cancel", "Cancelar")}</button>
      </div>
      {status === "error" && <p className="fine">{tr("Couldn't send right now. Please try again later.", "No se pudo enviar ahora. Inténtelo más tarde.")}</p>}
    </form>
  );
}
