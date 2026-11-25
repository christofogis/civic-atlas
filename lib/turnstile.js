// Server-side check of a Cloudflare Turnstile token (bot protection for paid/limited APIs).
// Returns true when the token is valid, or when no secret is configured (check disabled).
export async function verifyTurnstile(token, secret, ip) {
  if (!secret) return true;
  if (!token) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const body = await res.json();
    return body.success === true;
  } catch {
    return false;
  }
}

// Automated checks (GitHub Actions) send a shared secret instead of a Turnstile token. Only an
// exact match with LOOKUP_CHECK_TOKEN skips the check; with no token configured, nothing does.
export function isCheckRequest(header, secret) {
  if (!secret || !header || header.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= header.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
