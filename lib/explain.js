// "Explain this news story": find the members of Congress and bills a piece of text mentions.
// Pure functions so the same matching runs in the browser (pasted text) and in the Pages
// Function (a link). Matches are conservative: full names, or a title plus a last name that only
// one member of that chamber has.
import { extractBillRefs } from "./billrefs.js";

const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// HTML -> plain text (scripts, styles and tags removed; entities for quotes and spaces decoded).
export function htmlToText(html) {
  return String(html ?? "")
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;|&#x27;|&#39;/g, "'")
    .replace(/&#822[01];|&[lr]dquo;|&quot;/g, '"').replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/\s+/g, " ").trim();
}

// members: [{ bioguide_id, name, first_name, last_name, nickname, chamber, serving }]
export function findMembers(text, members) {
  const t = strip(text);
  const found = new Map();
  const byLast = new Map();
  for (const m of members) {
    const key = `${m.chamber}|${strip(m.last_name)}`;
    byLast.set(key, [...(byLast.get(key) ?? []), m]);
  }
  for (const m of members) {
    const last = strip(m.last_name);
    const names = new Set([m.name, `${m.first_name} ${m.last_name}`, m.nickname && `${m.nickname} ${m.last_name}`].filter(Boolean).map(strip));
    for (const n of names) {
      if (new RegExp(`\\b${esc(n)}\\b`).test(t)) { found.set(m.bioguide_id, m); break; }
    }
    if (found.has(m.bioguide_id)) continue;
    // "Sen. Padilla", "Senator Padilla", "Rep. Ocasio-Cortez": only when that last name is unique in the chamber.
    const titles = m.chamber === "senate" ? "Sen\\.|Senator|Sens\\." : "Rep\\.|Representative|Reps\\.|Congressman|Congresswoman|Del\\.|Delegate";
    if ((byLast.get(`${m.chamber}|${last}`) ?? []).length === 1 && new RegExp(`\\b(?:${titles})\\s+${esc(last)}\\b`).test(t)) {
      found.set(m.bioguide_id, m);
    }
  }
  return [...found.values()];
}

export function findBills(text) {
  return extractBillRefs(text);
}
