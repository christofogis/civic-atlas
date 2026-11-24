// Committee meetings (hearings, markups, business meetings) from the Congress.gov API's
// committee-meeting records. Witness lists come with House meetings only: Senate committees
// post theirs on their own sites, so Senate rows link there instead (see Hearing page).

const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const s = (v) => (v == null || v === "" ? null : String(v).trim());

// Congress.gov systemCode "hshm00" -> committee "HSHM"; "hshm09" -> subcommittee "HSHM09".
export function committeeId(systemCode) {
  const c = String(systemCode ?? "").toUpperCase();
  if (!/^[HSJ][A-Z]{3}\d{2}$/.test(c)) return null;
  return c.endsWith("00") ? c.slice(0, 4) : c;
}

// Bill types as Congress.gov writes them ("HR", "H.R.", "SJRES") -> ours ("hr", "sjres").
const billType = (t) => String(t ?? "").toLowerCase().replace(/[^a-z]/g, "");

const eventUrl = (congress, chamber, id) => `https://www.congress.gov/event/${congress}th-Congress/${chamber}-event/${id}`;

export function parseMeeting(cm) {
  const chamber = String(cm?.chamber ?? "").toLowerCase();
  const congress = parseInt(cm?.congress, 10);
  const id = s(cm?.eventId);
  if (!id || !congress || !["house", "senate"].includes(chamber)) return null;
  const loc = cm.location ?? {};
  const related = cm.relatedItems ?? {};
  const bills = list(related.bills).map((b) => {
    const t = billType(b.type), n = parseInt(b.number, 10), c = parseInt(b.congress, 10) || congress;
    return t && n ? `${c}-${t}-${n}` : null;
  }).filter(Boolean);
  const nominations = list(related.nominations).map((n) => (n.number ? `PN${n.number}${n.part ? `-${n.part}` : ""}` : null)).filter(Boolean);
  return {
    event_id: id,
    congress,
    chamber,
    meeting_at: s(cm.date),
    title: s(cm.title) ?? "(untitled meeting)",
    meeting_type: s(cm.type),
    status: s(cm.meetingStatus),
    location: [s(loc.building), s(loc.room)].filter(Boolean).join(", ") || null,
    committee_ids: [...new Set(list(cm.committees).map((c) => committeeId(c.systemCode)).filter(Boolean))],
    videos: list(cm.videos).filter((v) => v.url).map((v) => ({ url: String(v.url) })),
    documents: list(cm.meetingDocuments).filter((d) => d.url || d.description)
      .map((d) => ({ type: s(d.documentType), name: s(d.name) ?? s(d.description), url: s(d.url) })),
    witnesses: list(cm.witnesses).map((w) => ({ name: s(w.name), position: s(w.position), organization: s(w.organization) })).filter((w) => w.name),
    // Only written testimony is kept per witness; biographies and disclosure forms stay on Congress.gov.
    statements: list(cm.witnessDocuments).filter((d) => d.documentType === "Witness Statement" && d.url).map((d) => String(d.url)),
    bill_refs: [...new Set(bills)],
    nomination_refs: [...new Set(nominations)],
    // The printed transcript is reached from the Congress.gov event page.
    has_transcript: list(cm.hearingTranscript).length > 0,
    source_url: eventUrl(congress, chamber, id),
    updated_at_source: s(cm.updateDate),
  };
}

// Match a witness to their statement file by last name: ".../HHRG-119-HM00-Wstate-SenaM-20260224.pdf"
// is Mr. Mike Sena's. Returns null when it can't tell.
export function statementFor(witness, statements) {
  const last = String(witness?.name ?? "").replace(/^(Mr|Ms|Mrs|Dr|Hon|The Honorable|Gen|Adm|Rev)\.?\s+/i, "")
    .replace(/,?\s+(Jr|Sr|II|III|IV|PhD|MD|Esq)\.?$/i, "").trim().split(/\s+/).pop()?.replace(/[^A-Za-z]/g, "");
  if (!last) return null;
  const hits = statements.filter((u) => new RegExp(`-Wstate-${last}[A-Z]?-`, "i").test(u));
  return hits.length === 1 ? hits[0] : null;
}

// Some meeting titles are a whole agenda ("H.R. 1031 (Rep. Tenney) ... \r\n• H.R. 2323 ...").
// Returns a short heading and, for multi-line titles, the agenda lines to list beneath it.
export function meetingHeading(title, type) {
  const lines = String(title ?? "").split(/\r?\n/).map((l) => l.replace(/^[\s:•·\-–—*]+/, "").replace(/[;,]\s*$/, "").trim()).filter(Boolean);
  if (lines.length <= 1) {
    const t = lines[0] ?? "(untitled meeting)";
    return { heading: t.length > 220 ? `${t.slice(0, 217).trimEnd()}…` : t, agenda: null };
  }
  const itemLike = /^(H\.\s?R\.|S\.|H\.\s?Res|S\.\s?Res|H\.\s?J\.|S\.\s?J\.|H\.\s?Con|S\.\s?Con|PN\s?\d)/i;
  const first = lines[0];
  if (itemLike.test(first)) return { heading: `${type ?? "Meeting"} on ${lines.length} items`, agenda: lines };
  return { heading: first.replace(/:$/, ""), agenda: lines.slice(1) };
}
