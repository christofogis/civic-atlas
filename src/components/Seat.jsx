// A card's seat line on two lines, office then place (and any role), so that across a row of cards
// the names below start at the same height.
export default function Seat({ parts, extra }) {
  const [office, place] = parts;
  return (
    <p className="seat">
      <span className="seat-office">{office}</span>
      <span className="seat-place">{place}{extra && <>{place ? " · " : ""}{extra}</>}{!place && !extra && "\u00a0"}</span>
    </p>
  );
}
