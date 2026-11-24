// Liveness check for the Functions layer: GET /api/health
export function onRequestGet() {
  return Response.json({ ok: true, service: "civic-atlas" });
}
