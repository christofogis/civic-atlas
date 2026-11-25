import { useState } from "react";
import { tr } from "../lib/lang.js";

// Light / Dark / System. System (the default) follows the device; the other two are remembered
// on this device only. index.html applies the saved choice before the page draws.
const KEY = "civic-atlas:theme";
const read = () => { try { const t = localStorage.getItem(KEY); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } };

export default function ThemeSwitch() {
  const [theme, setTheme] = useState(read);
  function choose(t) {
    setTheme(t);
    try { if (t === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* storage unavailable */ }
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }
  const options = [["light", tr("Light", "Claro")], ["dark", tr("Dark", "Oscuro")], ["system", tr("System", "Sistema")]];
  return (
    <span className="theme-switch">
      <span id="theme-label">{tr("Theme", "Tema")}</span>
      <span className="toggle" role="group" aria-labelledby="theme-label">
        {options.map(([id, label]) => (
          <button key={id} type="button" aria-pressed={theme === id} className={theme === id ? "on" : ""} onClick={() => choose(id)}>{label}</button>
        ))}
      </span>
    </span>
  );
}
