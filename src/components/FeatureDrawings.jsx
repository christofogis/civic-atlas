// Line drawings for the home page's feature cards, in the same thin-stroke style as the three
// branches' buildings (BranchDrawing.jsx). Decorative: each card's words say what it is.
const common = { viewBox: "0 0 240 140", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, className: "feature-drawing" };

// A ballot with three choices, one marked.
export function BallotDrawing() {
  return (
    <svg {...common}>
      <line x1="20" y1="130" x2="220" y2="130" />
      <path d="M78 14 H162 V124 H78 Z" />
      <line x1="90" y1="28" x2="130" y2="28" />
      {[48, 74, 100].map((y, i) => (
        <g key={y}>
          <rect x="90" y={y} width="12" height="12" />
          <line x1="112" y1={y + 6} x2="150" y2={y + 6} />
          {i === 1 && <path d={`M92 ${y + 6} l4 4 l8 -10`} />}
        </g>
      ))}
    </svg>
  );
}

// A folded map with district lines and a pin.
export function MapDrawing() {
  return (
    <svg {...common}>
      <line x1="20" y1="130" x2="220" y2="130" />
      <path d="M40 30 L90 18 L150 30 L200 18 V112 L150 124 L90 112 L40 124 Z" />
      <line x1="90" y1="18" x2="90" y2="112" />
      <line x1="150" y1="30" x2="150" y2="124" />
      <path d="M40 70 Q70 60 90 74 T150 70 T200 62" strokeDasharray="3 4" />
      <path d="M120 23 Q112 60 130 116" strokeDasharray="3 4" />
      <path d="M170 64 c0 -12 18 -12 18 0 c0 9 -9 18 -9 18 c0 0 -9 -9 -9 -18 Z" />
      <circle cx="179" cy="64" r="3" />
    </svg>
  );
}

// Three buildings, smallest to largest, for the three branches.
export function BranchesDrawing() {
  const building = (x, w, h) => {
    const base = 124, top = base - h, cols = 4;
    return (
      <g key={x}>
        <rect x={x} y={top} width={w} height={h} />
        <path d={`M${x - 4} ${top} L${x + w / 2} ${top - w * 0.32} L${x + w + 4} ${top} Z`} />
        {Array.from({ length: cols }, (_, i) => {
          const cx = x + 8 + ((w - 16) * i) / (cols - 1);
          return <line key={i} x1={cx} y1={top + 6} x2={cx} y2={base} />;
        })}
      </g>
    );
  };
  return (
    <svg {...common}>
      <line x1="20" y1="124" x2="220" y2="124" />
      {building(32, 48, 46)}
      {building(96, 50, 62)}
      {building(162, 46, 40)}
    </svg>
  );
}

// A week on a calendar page, with one day marked.
export function WeekDrawing() {
  return (
    <svg {...common}>
      <line x1="20" y1="130" x2="220" y2="130" />
      <rect x="54" y="22" width="132" height="100" rx="4" />
      <line x1="54" y1="44" x2="186" y2="44" />
      <line x1="82" y1="14" x2="82" y2="30" />
      <line x1="158" y1="14" x2="158" y2="30" />
      {[0, 1, 2, 3].map((i) => <line key={`v${i}`} x1={54 + 26.4 * (i + 1)} y1="44" x2={54 + 26.4 * (i + 1)} y2="122" />)}
      <line x1="54" y1="83" x2="186" y2="83" />
      <circle cx="120" cy="64" r="8" />
      <path d="M100 100 h14 M126 100 h14 M74 100 h14" />
    </svg>
  );
}
