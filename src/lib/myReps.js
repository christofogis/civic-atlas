// The representatives from the visitor's last address lookup, kept in this browser tab only
// (sessionStorage) so other pages can point them out. Only member IDs are kept, never the address.
const KEY = "civic-atlas:my-reps";

export function rememberRepresentatives(ids) {
  try { sessionStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* storage unavailable */ }
}

export function myRepresentatives() {
  try { return new Set(JSON.parse(sessionStorage.getItem(KEY) ?? "[]")); } catch { return new Set(); }
}
