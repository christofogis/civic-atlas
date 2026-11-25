import { useEffect, useRef, useState } from "react";
import { tr } from "../lib/lang.js";

// Light / Dark / System, in the header beside the language switch. One small button (its icon
// shows the current choice) opens the three options, so it fits on a phone. System (the default)
// follows the device; a choice is remembered on this device only, and index.html applies it
// before the page draws.
const KEY = "civic-atlas:theme";
const read = () => { try { const t = localStorage.getItem(KEY); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; } };

const Icon = ({ theme }) => (
  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    {theme === "light" && <><circle cx="10" cy="10" r="3.6" />{[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
      const r = (a * Math.PI) / 180;
      return <line key={a} x1={10 + 6 * Math.cos(r)} y1={10 + 6 * Math.sin(r)} x2={10 + 8 * Math.cos(r)} y2={10 + 8 * Math.sin(r)} />;
    })}</>}
    {theme === "dark" && <path d="M15.5 12.6A6.5 6.5 0 0 1 7.4 4.5a6.5 6.5 0 1 0 8.1 8.1z" />}
    {theme === "system" && <><circle cx="10" cy="10" r="7" /><path d="M10 3a7 7 0 0 1 0 14z" fill="currentColor" /></>}
  </svg>
);

export default function ThemeSwitch() {
  const [theme, setTheme] = useState(read);
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  function choose(t) {
    setTheme(t);
    setOpen(false);
    try { if (t === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { /* storage unavailable */ }
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    window.dispatchEvent(new Event("civic-atlas:theme"));   // the map redraws in the new theme
  }
  const options = [["light", tr("Light", "Claro")], ["dark", tr("Dark", "Oscuro")], ["system", tr("System (same as this device)", "Sistema (igual que este dispositivo)")]];
  const current = options.find(([id]) => id === theme)[1];
  return (
    <span className="theme-switch" ref={box}>
      <button type="button" className="theme-button" aria-haspopup="true" aria-expanded={open}
        aria-label={tr(`Theme: ${current}`, `Tema: ${current}`)} title={tr("Light or dark", "Claro u oscuro")} onClick={() => setOpen((o) => !o)}>
        <Icon theme={theme} />
      </button>
      {open && (
        <span className="theme-menu" role="group" aria-label={tr("Theme", "Tema")}>
          {options.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={theme === id} className={theme === id ? "on" : ""} onClick={() => choose(id)}>
              <Icon theme={id} /> {label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
