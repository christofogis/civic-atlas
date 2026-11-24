// A 0–100% scale: where this member sits, with a tick for the typical member of the chamber.
// Gives a percentage the context a bare number lacks. Text carries the same information for
// screen readers.
export default function Scale({ value, typical, label, typicalLabel = "typical" }) {
  if (value == null || Number.isNaN(value)) return null;
  const pct = (x) => `${Math.max(0, Math.min(100, x * 100))}%`;
  const text = `${label}: ${Math.round(value * 100)}%${typical != null ? `; ${typicalLabel}: ${Math.round(typical * 100)}%` : ""}`;
  return (
    <div className="scale" role="img" aria-label={text}>
      <div className="scale-track">
        <div className="scale-fill" style={{ width: pct(value) }} />
        {typical != null && <div className="scale-typical" style={{ left: pct(typical) }} title={`${typicalLabel}: ${Math.round(typical * 100)}%`} />}
      </div>
      <div className="scale-legend" aria-hidden="true">
        <span><strong>{Math.round(value * 100)}%</strong> {label}</span>
        {typical != null && <span className="scale-legend-typical">{typicalLabel} {Math.round(typical * 100)}%</span>}
      </div>
    </div>
  );
}
