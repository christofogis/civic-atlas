# Accounts: setup

Optional accounts let people sign in with an email link or code (and, later, Google) so they can save
officials and bills across devices and choose which emails they get. The site works fully without one.
Everything is off until the steps below are done, through two public switches in `src/lib/config.js`:

- `ACCOUNTS_ENABLED`: the Sign in link, the Save buttons, the account page, and the accounts section of
  How this site works. Off until steps 1 to 4 are done.
- `AUTH_GOOGLE_ENABLED`: the "Sign in with Google" button. Off until step 6 is done.

No secrets are involved on the site side. The browser uses the publishable key that is already in
`config.js`; Row Level Security limits each signed-in person to their own rows. The Google client
secret and any SMTP password go only into the Supabase dashboard, never into the repo or Pages.

## 1. Apply the migration

`supabase/migrations/20261127000400_accounts.sql` adds `account_prefs`, `email_consent_events`,
`followed_officials`, `followed_bills` (RLS on all four, own rows only, nothing for anonymous visitors),
a trigger on `auth.users` that creates the preferences row (all emails off), and the functions
`delete_my_account()`, `my_account_data()` and `unsubscribe_email(token, kind)`.

After applying, run the Supabase security and performance advisors and check they report nothing new.

## 2. URL configuration

Supabase dashboard > Authentication > URL Configuration:

- **Site URL:** `https://civic-atlas-cub.pages.dev` (the default, `http://localhost:3000`, would send
  sign-in links to nowhere).
- **Redirect URLs** (add each):
  - `https://civic-atlas-cub.pages.dev/account`
  - `https://*.civic-atlas-cub.pages.dev/account` (Cloudflare preview and branch deployments)
  - `http://localhost:5173/account` (local `npm run dev`)
  - later, the same path on any custom domain.

The site always asks to come back to `/account`; Supabase refuses any address not on this list.

## 3. Email sign-in

Authentication > Sign In / Providers > Email: enabled, "Confirm email" on. Authentication > Sign In /
Providers > "Allow new users to sign up" on.

Authentication > Emails > Templates: the sign-in form tells people they can use the link or type the
code, so both templates must include the code. In **Magic Link** (existing accounts) and **Confirm
signup** (first sign-in), keep the link and add the code, for example:

```html
<h2>Sign in to Civic Atlas</h2>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>
<p>Or type this code on the sign-in page: <strong>{{ .Token }}</strong></p>
<p>If you didn't ask for this, you can ignore this email. / Si usted no lo pidió, puede ignorar este correo.</p>
```

The link works in the browser that asked for it (PKCE flow); the code covers opening the email on
another device. Codes and links expire after the "Email OTP Expiration" setting (default 1 hour).

## 4. Email sender (needed before opening accounts to the public)

Supabase's built-in email sender is for testing only: it is rate-limited to a few emails per hour for
the whole project, and it only delivers to the email addresses of members of your Supabase
organization. Strangers would never get their sign-in email. Before turning `ACCOUNTS_ENABLED` on for
everyone, set a custom SMTP sender:

1. Create an account with an email provider (Resend, Postmark, Amazon SES and others work).
   It needs a domain you own to send from (for example `mail.<your-domain>`); a `pages.dev` address
   can't be verified. Add the DNS records (SPF, DKIM) the provider gives you.
2. Supabase > Authentication > Emails > SMTP Settings > enable custom SMTP. For Resend:
   host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key
   (sending access only), sender `Civic Atlas <signin@mail.<your-domain>>`.
3. Authentication > Rate Limits: raise "emails sent per hour" to fit (for example 100), and keep the
   per-address limits.

Until then, accounts can be tried with your own address (an organization member) on a preview deploy
with `ACCOUNTS_ENABLED` switched on there.

## 5. Turn accounts on

Set `ACCOUNTS_ENABLED = true` in `src/lib/config.js`, deploy, and check on the live site:

- Sign in with an email link, and with the code in a second browser.
- Save an official and a bill; sign in elsewhere and see them.
- Change each email choice; reload; the choices stay. "Download my data" shows them and the consent
  record.
- "Delete my account", then confirm in the dashboard (Authentication > Users) that the user is gone,
  and with SQL that no rows are left for that id in the four tables.

## 6. Google sign-in (optional)

In Google Cloud Console, in a project for Civic Atlas:

1. Google Auth Platform > Branding (the OAuth consent screen): app name "Civic Atlas", a support email,
   home page `https://civic-atlas-cub.pages.dev`, privacy policy
   `https://civic-atlas-cub.pages.dev/methods#accounts`. Audience: External. Data access (scopes):
   only `openid`, `.../auth/userinfo.email` and `.../auth/userinfo.profile`; these need no Google review.
   Publish the app (Audience > Publish), or only test users can sign in.
2. Google Auth Platform > Clients > Create client > Web application, name "Civic Atlas (Supabase)":
   - Authorized JavaScript origins: `https://civic-atlas-cub.pages.dev` and `http://localhost:5173`
   - Authorized redirect URIs: `https://fkbzxaoeyrtzviyfzulq.supabase.co/auth/v1/callback`
     (Google returns to Supabase, which then returns to the site's `/account`, step 2).
3. Copy the Client ID and Client secret into Supabase > Authentication > Sign In / Providers > Google,
   enable it, and save. The secret stays in Supabase only.
4. Set `AUTH_GOOGLE_ENABLED = true` in `src/lib/config.js` and deploy.

Google's screen will say "continue to fkbzxaoeyrtzviyfzulq.supabase.co" until the project has a custom
domain for Supabase Auth (a paid add-on); that's expected. An email address used with both Google and
an email link becomes one account (Supabase links verified identities with the same email).

## 7. Sending emails (not built)

Nothing sends email yet, and the account page says so. A later job (GitHub Actions, service-role key)
would:

- read `account_prefs` joined to `auth.users` for people with a choice turned on, in their `language`;
  weekly votes from `followed_officials`, bill actions from `followed_bills`, election dates for
  `election_state`;
- put the unsubscribe link in each email:
  `https://civic-atlas-cub.pages.dev/unsubscribe?t=<unsubscribe_token>&k=<weekly_digest|bill_updates|election_reminders|all>`,
  and the headers `List-Unsubscribe: <https://civic-atlas-cub.pages.dev/api/unsubscribe?t=...&k=...>` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (handled by `functions/api/unsubscribe.js`);
- send only to people whose choice is on at send time, through the same provider as step 4.

That job needs its own review (wording, neutrality, volume, the provider's terms) before it runs.
