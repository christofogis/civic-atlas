// Line drawings of the three buildings: the Capitol, the White House and the Supreme Court.
// Decorative; thin strokes in the current text color.
const common = { viewBox: "0 0 240 140", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "branch-drawing" };
const cols = (x0, x1, n, top, bottom) => Array.from({ length: n }, (_, i) => {
  const x = x0 + ((x1 - x0) * i) / (n - 1);
  return <line key={i} x1={x} y1={top} x2={x} y2={bottom} />;
});

export function Capitol() {
  return (
    <svg {...common}>
      <line x1="10" y1="128" x2="230" y2="128" />
      <rect x="20" y="98" width="200" height="30" />
      <rect x="20" y="92" width="200" height="6" />
      {cols(30, 70, 5, 98, 128)}{cols(170, 210, 5, 98, 128)}
      <path d="M95 92 L120 80 L145 92" />
      {cols(100, 140, 5, 92, 128)}
      <rect x="92" y="62" width="56" height="18" />
      {cols(96, 144, 9, 62, 80)}
      <path d="M90 62 Q120 14 150 62" />
      <path d="M104 50 Q120 30 136 50" />
      <rect x="114" y="18" width="12" height="10" />
      <line x1="120" y1="18" x2="120" y2="8" />
      <circle cx="120" cy="7" r="1.5" />
    </svg>
  );
}

export function WhiteHouse() {
  return (
    <svg {...common}>
      <line x1="10" y1="128" x2="230" y2="128" />
      <rect x="30" y="64" width="180" height="64" />
      <line x1="26" y1="64" x2="214" y2="64" />
      <rect x="30" y="58" width="180" height="6" />
      {[44, 62, 166, 184].flatMap((x) => [<rect key={`a${x}`} x={x} y="74" width="10" height="16" />, <rect key={`b${x}`} x={x} y="102" width="10" height="16" />])}
      <path d="M86 64 L120 44 L154 64" />
      {cols(90, 150, 6, 64, 128)}
      <rect x="114" y="108" width="12" height="20" />
    </svg>
  );
}

export function SupremeCourt() {
  return (
    <svg {...common}>
      <line x1="10" y1="132" x2="230" y2="132" />
      <path d="M40 132 V126 H200 V132" />
      <path d="M48 126 V120 H192 V126" />
      <rect x="56" y="62" width="128" height="58" />
      {cols(64, 176, 8, 66, 120)}
      <rect x="52" y="56" width="136" height="6" />
      <path d="M50 56 L120 26 L190 56 Z" />
    </svg>
  );
}
