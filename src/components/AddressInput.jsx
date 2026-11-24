import { useEffect, useId, useRef, useState } from "react";
import { GOOGLE_PLACES_KEY } from "../lib/config.js";

// Address box with suggestions from Google Places Autocomplete (New), called straight from the
// browser with a referrer-restricted key. Without a key, or if Google fails, it is a plain text
// box. Suggestions are grouped into one billing session that ends when one is picked, so a
// lookup costs one session rather than one charge per keystroke.
const API = "https://places.googleapis.com/v1";
const MIN_CHARS = 4;
const DEBOUNCE_MS = 250;
const newSession = () => (crypto.randomUUID?.() ?? String(Math.random()).slice(2));

export default function AddressInput({ id, value, onChange, onPick, placeholder }) {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const session = useRef(newSession());
  const typed = useRef(false);   // only suggest for what the visitor typed, not a picked address
  const listId = useId();
  const enabled = Boolean(GOOGLE_PLACES_KEY);

  useEffect(() => {
    if (!enabled || !typed.current || value.trim().length < MIN_CHARS) { setItems([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/places:autocomplete`, {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
            "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text" },
          body: JSON.stringify({ input: value, sessionToken: session.current, includedRegionCodes: ["us", "pr", "gu", "vi", "as", "mp"] }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        const next = (body.suggestions ?? []).map((s) => s.placePrediction).filter(Boolean)
          .map((p) => ({ id: p.placeId, text: p.text?.text ?? "" })).filter((p) => p.text).slice(0, 5);
        setItems(next);
        setActive(-1);
        setOpen(next.length > 0);
      } catch {
        if (!ctrl.signal.aborted) setItems([]);   // suggestions are a convenience; typing still works
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, enabled]);

  const pick = async (item) => {
    typed.current = false;
    setOpen(false);
    setItems([]);
    onChange(item.text);
    // Ending the session with a details request is what makes the suggestions above it free.
    let address = item.text;
    try {
      const res = await fetch(`${API}/places/${encodeURIComponent(item.id)}?sessionToken=${encodeURIComponent(session.current)}`, {
        headers: { "X-Goog-Api-Key": GOOGLE_PLACES_KEY, "X-Goog-FieldMask": "formattedAddress" },
      });
      if (res.ok) address = (await res.json()).formattedAddress ?? address;
    } catch { /* keep the suggestion text */ }
    session.current = newSession();
    onChange(address);
    onPick?.(address);
  };

  const onKeyDown = (e) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? items.length - 1 : a - 1)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div className="address-input">
      <input
        id={id}
        type="text"
        autoComplete="street-address"
        placeholder={placeholder}
        value={value}
        role={enabled ? "combobox" : undefined}
        aria-autocomplete={enabled ? "list" : undefined}
        aria-expanded={enabled ? open : undefined}
        aria-controls={enabled ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => { typed.current = true; onChange(e.target.value); }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => items.length && setOpen(true)}
      />
      {enabled && open && (
        <ul id={listId} role="listbox" className="suggestions" aria-label="Address suggestions">
          {items.map((it, i) => (
            <li key={it.id} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              className={i === active ? "on" : ""} onMouseDown={(e) => { e.preventDefault(); pick(it); }}>
              {it.text}
            </li>
          ))}
          <li role="presentation" className="attribution">Suggestions from Google Maps</li>
        </ul>
      )}
    </div>
  );
}
