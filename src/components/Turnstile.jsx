import { useEffect, useRef } from "react";

// Renders Cloudflare's Turnstile check and reports each token via onToken.
// Usually invisible; shows a checkbox only when Cloudflare isn't sure.
let scriptPromise;
function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export default function Turnstile({ siteKey, onToken, resetSignal }) {
  const box = useRef(null);
  const widget = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !box.current || widget.current != null) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: siteKey,
        // Stay out of sight unless Cloudflare needs the visitor to do something.
        appearance: "interaction-only",
        callback: (t) => onToken(t),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    }).catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (widget.current != null) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  // Tokens are single-use: get a fresh one after each lookup.
  useEffect(() => {
    if (resetSignal && widget.current != null) { onToken(""); window.turnstile.reset(widget.current); }
  }, [resetSignal]);

  return <div ref={box} className="turnstile" />;
}
