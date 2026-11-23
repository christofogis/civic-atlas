// Simple liveness check for the serverless layer: GET /api/health
export default function handler(req, res) {
  res.status(200).json({ ok: true, service: "civic-atlas" });
}
