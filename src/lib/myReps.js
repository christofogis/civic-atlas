// The representatives from the visitor's last address lookup, remembered on this device only
// (localStorage) so the home page and other pages can point them out. Only member IDs are kept,
// never the address. The visitor can forget them at any time.
const KEY = "civic-atlas:my-reps";

export function rememberRepresentatives(ids) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
}

export function myRepresentatives() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? sessionStorage.getItem(KEY) ?? "[]")); } catch { return new Set(); }
}

export function forgetRepresentatives() {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
