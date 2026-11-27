import { useLayoutEffect, useRef, useState } from "react";
import { tr } from "../lib/lang.js";

// Long official text (hearing titles, bill titles) shown in full but cut to a few lines, with
// "more" to open it. Shortened by layout only: the words themselves are never rewritten.
// Records are published in English, so the text is marked lang="en" (screen readers then read it
// with English pronunciation on Spanish pages); pass lang={null} for text that may be translated.
export default function Clamp({ lines = 2, children, className = "", lang = "en" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setLong(el.scrollHeight > el.clientHeight + 2);
  }, [children, open]);
  return (
    <span className={`clamp-wrap ${className}`}>
      <span ref={ref} lang={lang ?? undefined} className={open ? "clamp-open" : "clamp"} style={open ? undefined : { WebkitLineClamp: lines }}>{children}</span>
      {(long || open) && (
        <button type="button" className="link fine clamp-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? tr("less", "menos") : tr("more", "más")}
        </button>
      )}
    </span>
  );
}
