// Pure helpers for optional accounts (no React, no network), so they can be tested in Node.
// An account stores only IDs the person chose to save and their email choices; never an address.

export const EMAIL_KINDS = ["weekly_digest", "bill_updates", "election_reminders"];
export const BILL_TYPES = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"];

export const isMemberId = (id) => typeof id === "string" && /^[A-Z]\d{6}$/.test(id);
export const isStatePersonId = (id) => typeof id === "string" && /^ocd-person\/[0-9a-f-]{36}$/.test(id);

// A saved official as stored: { kind: "member" | "state", official_id }. Null if the ID isn't valid.
export function officialRow(id) {
  if (isMemberId(id)) return { kind: "member", official_id: id };
  if (isStatePersonId(id)) return { kind: "state", official_id: id };
  return null;
}
export const officialKey = (r) => `${r.kind}:${r.official_id}`;

export function billRow(congress, type, number) {
  const c = Number(congress), n = Number(number), t = String(type ?? "").toLowerCase();
  if (!Number.isInteger(c) || c < 93 || c > 200 || !BILL_TYPES.includes(t) || !Number.isInteger(n) || n < 1 || n > 99999) return null;
  return { congress: c, bill_type: t, number: n };
}
export const billKey = (r) => `${r.congress}-${r.bill_type}-${r.number}`;
export const billPath = (r) => `/bill/${r.congress}/${r.bill_type}/${r.number}`;

// Officials remembered on this device (civic-atlas:my-reps) that aren't saved to the account yet.
export function officialsToSync(localIds, saved) {
  const have = new Set((saved ?? []).map(officialKey));
  const out = [];
  for (const id of localIds ?? []) {
    const r = officialRow(id);
    if (r && !have.has(officialKey(r)) && !out.some((o) => officialKey(o) === officialKey(r))) out.push(r);
  }
  return out;
}

// Saved districts (link parameters) cleaned to the keys the site uses, with district-sized values
// only. Anything else, such as an address someone pasted into a link, is dropped. Null without a state.
const DISTRICT_KEYS = { st: /^[A-Z]{2}$/, cg: /^\d{3}$/, cd: /^\d{1,2}(,\d{1,2}){0,3}$/, su: /^[a-z0-9,]{1,80}$/i,
  sl: /^[a-z0-9,]{1,80}$/i, bo: /^[1-4]$/, co: /^[a-z]{2}-[a-z-]{1,40}$/, sd: /^\d{1,2}$/, pl: /^[A-Za-z .'-]{1,60}$/,
  pt: /^[cu]$/, cc: /^\d{1,2}$/ };
export function cleanDistricts(str) {
  if (typeof str !== "string" || str.length > 300) return null;
  const p = new URLSearchParams(str);
  const out = new URLSearchParams();
  for (const [k, re] of Object.entries(DISTRICT_KEYS)) {
    const v = p.get(k);
    if (v != null && re.test(v)) out.set(k, v);
  }
  return out.get("st") ? out.toString() : null;
}
export const districtsState = (str) => new URLSearchParams(cleanDistricts(str) ?? "").get("st");

// The change to send when a person turns one email choice on or off.
export function emailChoice(kind, on) {
  if (!EMAIL_KINDS.includes(kind)) throw new Error(`unknown email kind ${kind}`);
  return { [kind]: Boolean(on) };
}

// Unsubscribe link parameters (?t=<token>&k=<kind|all>), checked. Null if either is malformed.
export function unsubscribeParams(search) {
  const p = new URLSearchParams(search);
  const t = (p.get("t") ?? "").toLowerCase();
  const k = p.get("k") ?? "all";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(t)) return null;
  if (k !== "all" && !EMAIL_KINDS.includes(k)) return null;
  return { token: t, kind: k };
}

// File name for "Download my data".
export const exportFileName = (date = new Date()) => `civic-atlas-account-${date.toISOString().slice(0, 10)}.json`;

// A plain email check before asking Supabase to send a link (Supabase checks again).
export const looksLikeEmail = (s) => typeof s === "string" && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

// Sign-in code from the email: 6 to 10 digits (Supabase's default is 6).
export const cleanCode = (s) => String(s ?? "").replace(/\D/g, "").slice(0, 10);
