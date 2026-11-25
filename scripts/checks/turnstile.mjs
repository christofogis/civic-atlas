// Is the human check (Cloudflare Turnstile) enforced on /api/lookup? Sends one lookup with no
// token and no check token. With TURNSTILE_SECRET_KEY set in Cloudflare Pages it is refused (403)
// before any address lookup is spent. Reports only; doesn't fail the run.
const site = process.env.SITE_URL ?? "https://civic-atlas-cub.pages.dev";
const res = await fetch(`${site}/api/lookup?address=${encodeURIComponent("1600 Pennsylvania Ave NW, Washington, DC 20500")}`);
const body = await res.json().catch(() => ({}));
if (res.status === 403) console.log("Human check: ENFORCED (a lookup without a token was refused).");
else if (res.ok) console.log("Human check: NOT enforced (a lookup without a token went through). Add TURNSTILE_SECRET_KEY in Cloudflare Pages settings.");
else console.log(`Human check: unclear (status ${res.status}: ${body.error ?? "no message"}).`);
