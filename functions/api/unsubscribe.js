// POST /api/unsubscribe?t=<token>&k=<kind|all>   one-click unsubscribe (RFC 8058)
//
// For the List-Unsubscribe / List-Unsubscribe-Post headers of future emails: mail apps POST here
// when someone presses their "Unsubscribe" button. The visible link in an email goes to the
// /unsubscribe page instead, which asks before changing anything (link scanners open GET links).
// The token is random per account; the database function turns the choice off and records when.
// Nothing is logged here.
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../src/lib/config.js";
import { unsubscribeParams } from "../../src/lib/account.js";

const reply = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestPost({ request }) {
  const p = unsubscribeParams(new URL(request.url).search);
  if (!p) return reply({ error: "Invalid unsubscribe link." }, 400);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/unsubscribe_email`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ token: p.token, kind: p.kind }),
  });
  if (!res.ok) return reply({ error: "Couldn't unsubscribe right now." }, 502);
  // Unknown tokens get the same answer, so the endpoint can't be used to test tokens.
  return reply({ ok: true });
}
