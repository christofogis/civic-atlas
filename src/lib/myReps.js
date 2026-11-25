// The representatives from the visitor's last address lookup, remembered on this device only
// (localStorage) so the home page and other pages can point them out. Only member IDs and the
// Congress they were looked up under are kept, never the address. A new Congress can bring new
// district lines, so a lookup from an earlier Congress is set aside and the visitor is asked to
// look up again. The visitor can forget them at any time.
import { congressOn } from "../../lib/congress.js";

const KEY = "civic-atlas:my-reps";

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY) ?? "null");
    if (!v) return null;
    // Before Nov 2026 only the IDs were kept; those lookups were made under the 119th Congress.
    return Array.isArray(v) ? { c: 119, ids: v } : v;
  } catch { return null; }
}

export function rememberRepresentatives(ids) {
  try { localStorage.setItem(KEY, JSON.stringify({ c: congressOn(), ids })); } catch { /* storage unavailable */ }
}

export function myRepresentatives() {
  const v = read();
  return new Set(v && v.c === congressOn() ? v.ids : []);
}

// True when the last lookup was made under an earlier Congress.
export function representativesOutdated() {
  const v = read();
  return Boolean(v && v.c < congressOn());
}

export function forgetRepresentatives() {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
