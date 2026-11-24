import { useState } from "react";

// "Follow" links that need no account: an RSS feed for news-reader apps and a calendar
// subscription (webcal) that phones and calendar apps keep up to date on their own.
export default function Follow({ feed, calendar, calendarLabel = "Add hearings to your calendar" }) {
  const [copied, setCopied] = useState(false);
  const origin = window.location.origin;
  const feedUrl = feed && `${origin}${feed}`;
  const calUrl = calendar && `${origin}${calendar}`.replace(/^https?:/, "webcal:");
  const copy = async () => {
    try { await navigator.clipboard.writeText(feedUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
  };
  return (
    <p className="follow fine">
      Follow:{" "}
      {calendar && <><a href={calUrl}>{calendarLabel}</a>{feed && " · "}</>}
      {feed && <><a href={feedUrl}>News feed (RSS)</a> <button type="button" className="link fine" onClick={copy}>{copied ? "Copied" : "Copy feed link"}</button></>}
      {" "}<span>No account needed.</span>
    </p>
  );
}
