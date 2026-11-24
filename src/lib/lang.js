// Current language for helpers outside React components (formatting, vote labels). Plain JS so
// Node scripts and tests can import those helpers too. Components use useLang() from i18n.jsx.
const KEY = "civic-atlas:lang";
const read = () => {
  try { const v = globalThis.localStorage?.getItem(KEY); if (v === "es" || v === "en") return v; } catch { /* storage off */ }
  return "en";
};
let current = read();
if (typeof document !== "undefined") document.documentElement.lang = current;

export const getLang = () => current;
export function setCurrentLang(l) {
  current = l;
  try { globalThis.localStorage?.setItem(KEY, l); } catch { /* storage off */ }
  if (typeof document !== "undefined") document.documentElement.lang = l;
}
export const tr = (en, es) => (current === "es" && es != null ? es : en);
export const locale = () => (current === "es" ? "es-US" : "en-US");
