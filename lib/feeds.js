// Builders for the "follow" feeds: RSS 2.0 for news readers and iCalendar for calendar apps.
// Pure functions, so they can be tested without the network.

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// items: [{ title, link, date (ISO or YYYY-MM-DD), description?, guid }]
export function rss({ title, link, description, items }) {
  const rfc = (d) => new Date(d.length === 10 ? `${d}T12:00:00Z` : d).toUTCString();
  const body = items.map((i) => `    <item>
      <title>${esc(i.title)}</title>
      <link>${esc(i.link)}</link>
      <guid isPermaLink="false">${esc(i.guid)}</guid>
      <pubDate>${rfc(i.date)}</pubDate>${i.description ? `
      <description>${esc(i.description)}</description>` : ""}
    </item>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${esc(title)}</title>
    <link>${esc(link)}</link>
    <description>${esc(description)}</description>
    <language>en-us</language>
${body}
  </channel>
</rss>
`;
}

// Fold long lines at 75 octets as RFC 5545 requires (approximated by characters).
const fold = (line) => line.match(/.{1,74}/g).join("\r\n ");
const icsText = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// "10:00 AM" -> "100000"
function hhmmss(t) {
  const m = String(t ?? "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) h += 12;
  return `${String(h).padStart(2, "0")}${m[2]}00`;
}

// events: rows from upcoming_events. Timed events are in Eastern time, an hour long by default;
// events with no time (or only a week) are all-day.
export function ics({ name, events, origin, stamp = new Date() }) {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Civic Atlas//Congress schedule//EN", "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsText(name)}`, "X-WR-TIMEZONE:America/New_York", "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
  ];
  for (const e of events) {
    const day = e.event_date.replace(/-/g, "");
    const start = !e.week_of && hhmmss(e.event_time);
    const kind = { hearing: "Hearing", markup: "Markup", meeting: "Meeting", floor: "House floor (week of)", convene: "Senate convenes" }[e.kind] ?? "";
    lines.push("BEGIN:VEVENT", `UID:${e.event_id}@civic-atlas`, `DTSTAMP:${dtstamp}`);
    if (start) {
      const endH = String(Math.min(23, Number(start.slice(0, 2)) + 1)).padStart(2, "0");
      lines.push(`DTSTART;TZID=America/New_York:${day}T${start}`, `DTEND;TZID=America/New_York:${day}T${endH}${start.slice(2)}`);
    } else {
      const next = new Date(`${e.event_date}T12:00:00Z`);
      next.setUTCDate(next.getUTCDate() + (e.week_of ? 5 : 1));
      lines.push(`DTSTART;VALUE=DATE:${day}`, `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`);
    }
    const who = e.committee_name ? `${e.chamber === "house" ? "House" : "Senate"} ${e.committee_name}` : e.chamber === "house" ? "House" : "Senate";
    lines.push(
      fold(`SUMMARY:${icsText(`${kind}: ${who}${e.kind === "floor" ? "" : ""} — ${e.title}`)}`),
      ...(e.location ? [fold(`LOCATION:${icsText(e.location)}`)] : []),
      fold(`DESCRIPTION:${icsText(`${e.status && e.status !== "Scheduled" ? `${e.status}. ` : ""}Schedule: ${e.source_url}\nVia Civic Atlas: ${origin}`)}`),
      fold(`URL:${e.source_url}`),
      `STATUS:${/cancel/i.test(e.status ?? "") ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
