import { createContext, Fragment, useContext, useState } from "react";
import { getLang, setCurrentLang } from "./lang.js";
export { tr, locale, getLang } from "./lang.js";

// English and Spanish. Strings are written in pairs where they're used — t("Members", "Miembros")
// — so each sentence's two versions sit side by side and stay in step. Records (vote positions,
// bill titles, the Clerk's wording) stay in their original English, as published.
const Ctx = createContext({ lang: "en", setLang: () => {}, t: (en) => en });

export function LangProvider({ children }) {
  const [lang, set] = useState(getLang());
  const setLang = (l) => { setCurrentLang(l); set(l); };
  const t = (en, es) => (lang === "es" && es != null ? es : en);
  // Re-mount the page on a switch so every string, date and number is redrawn in the new language.
  return <Ctx.Provider value={{ lang, setLang, t }}><Fragment key={lang}>{children}</Fragment></Ctx.Provider>;
}

export const useLang = () => useContext(Ctx);
