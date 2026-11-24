import { useState } from "react";
import { tr } from "../lib/lang.js";

// "Follow" links that need no account: an RSS feed for news-reader apps and a calendar
// subscription (webcal) that phones and calendar apps keep up to date on their own.
export default function Follow({ feed, calendar, calendarLabel = tr("Add hearings to your calendar", "Agregar audiencias a su calendario") }) {
  const [copied, setCopied] = useState(false);
  const origin = window.location.origin;
  const feedUrl = feed && `${origin}${feed}`;
  const calUrl = calendar && `${origin}${calendar}`.replace(/^https?:/, "webcal:");
  const copy = async () => {
    try { await navigator.clipboard.writeText(feedUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  return (
    <p className="follow fine">
      {tr("Follow", "Seguir")}:{" "}
      {calendar && <><a href={calUrl}>{calendarLabel}</a>{feed && " · "}</>}
      {feed && <><a href={feedUrl}>{tr("News feed (RSS)", "Fuente de noticias (RSS, en inglés)")}</a> <button type="button" className="link fine" onClick={copy}>{copied ? tr("Copied", "Copiado") : tr("Copy feed link", "Copiar enlace de la fuente")}</button></>}
      {" "}<span>{tr("No account needed.", "No necesita cuenta.")}</span>
    </p>
  );
}
