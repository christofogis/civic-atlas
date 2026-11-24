import { useState } from "react";
import { useLocation } from "react-router-dom";
import { db } from "../lib/db.js";

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
    const { error } = await db.rpc("submit_error_report", { page: `${pathname}${search}`, message: text.trim() });
    setStatus(error ? "error" : "sent");
    if (!error) setText("");
  }

  if (!open) return <button type="button" className="link fine" onClick={() => { setOpen(true); setStatus("idle"); }}>Report an error on this page</button>;
  if (status === "sent") return <p className="fine">Thanks. Your report was sent with this page's address.</p>;
  return (
    <form onSubmit={submit} className="report">
      <label htmlFor="report-text" className="fine">What's wrong on this page? Please don't include personal information.</label>
      <textarea id="report-text" rows={3} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      <div className="row-inline">
        <button type="submit" disabled={status === "sending" || text.trim().length < 5}>{status === "sending" ? "Sending…" : "Send"}</button>
        <button type="button" className="link" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {status === "error" && <p className="fine">Couldn't send right now. Please try again later.</p>}
    </form>
  );
}
