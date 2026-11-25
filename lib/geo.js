// Point-in-polygon for GeoJSON Polygon and MultiPolygon features (lon/lat). Ray casting, with
// holes: a point inside a hole is outside. Used by the lookup for local districts.
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPolygon = (x, y, rings) => inRing(x, y, rings[0]) && !rings.slice(1).some((h) => inRing(x, y, h));

export function containing(features, lon, lat) {
  return features.find((f) => {
    const g = f.geometry;
    if (!g) return false;
    if (g.type === "Polygon") return inPolygon(lon, lat, g.coordinates);
    if (g.type === "MultiPolygon") return g.coordinates.some((p) => inPolygon(lon, lat, p));
    return false;
  }) ?? null;
}
