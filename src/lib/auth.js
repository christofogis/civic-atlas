// Optional sign-in (Supabase Auth) and the signed-in person's saved items. The sign-in library is
// loaded only when it's needed: on the account page, when returning from a sign-in link, or when
// this browser already holds a session. Everyone else downloads nothing extra and the site
// reads the database exactly as before (src/lib/db.js).
import { useSyncExternalStore } from "react";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ACCOUNTS_ENABLED } from "./config.js";

// Where Supabase keeps the session in this browser (only after someone signs in).
export const SESSION_KEY = "civic-atlas:auth";

export function hasStoredSession() {
  try { return Boolean(localStorage.getItem(SESSION_KEY)); } catch { return false; }
}
// A return from a sign-in link or Google: ?code=... (PKCE) or an error from the auth server.
const returningFromSignIn = () => /[?&](code|error_description)=/.test(globalThis.location?.search ?? "");

let clientPromise = null;
export function authClient() {
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: SESSION_KEY },
  }));
  return clientPromise;
}

// One shared state for the header, the account page and the Save buttons.
// status: "off" (accounts not enabled) | "idle" (not checked; no session in this browser) |
// "loading" | "signedOut" | "signedIn".
let state = { status: ACCOUNTS_ENABLED ? "idle" : "off", user: null, officials: [], bills: [] };
const listeners = new Set();
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const useAccount = () => useSyncExternalStore(subscribe, () => state, () => state);

let started = false;
// Load the client and the session. Called by the account page, and at startup when there is a
// session or a sign-in return to finish.
export async function startAuth() {
  if (!ACCOUNTS_ENABLED || started) return;
  started = true;
  set({ status: "loading" });
  try {
    const sb = await authClient();
    sb.auth.onAuthStateChange((event, session) => {
      // Supabase's own lock: do the follow-up reads outside this callback.
      setTimeout(() => applySession(session), 0);
    });
    const { data } = await sb.auth.getSession();
    await applySession(data.session);
    if (returningFromSignIn()) {
      // Drop ?code= from the address bar so a reload or a shared link doesn't carry it.
      const url = new URL(window.location.href);
      ["code", "error", "error_code", "error_description"].forEach((k) => url.searchParams.delete(k));
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  } catch {
    set({ status: "signedOut", user: null });
  }
}
if (ACCOUNTS_ENABLED && typeof window !== "undefined" && (hasStoredSession() || returningFromSignIn())) startAuth();

let lastUserId = null;
async function applySession(session) {
  const user = session?.user ?? null;
  if (!user) { lastUserId = null; set({ status: "signedOut", user: null, officials: [], bills: [] }); return; }
  if (user.id === lastUserId && state.status === "signedIn") { set({ user }); return; }
  lastUserId = user.id;
  set({ status: "signedIn", user });
  await refreshSaved();
}

export async function refreshSaved() {
  const sb = await authClient();
  const [o, b] = await Promise.all([
    sb.from("followed_officials").select("kind, official_id, created_at").order("created_at"),
    sb.from("followed_bills").select("congress, bill_type, number, created_at").order("created_at"),
  ]);
  set({ officials: o.data ?? [], bills: b.data ?? [] });
}

const site = () => window.location.origin;

export async function sendEmailLink(email, lang) {
  const sb = await authClient();
  const { error } = await sb.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${site()}/account`, shouldCreateUser: true, data: { lang } },
  });
  if (error) throw error;
}
export async function verifyEmailCode(email, code) {
  const sb = await authClient();
  const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
  if (error) throw error;
}
export async function signInWithGoogle() {
  const sb = await authClient();
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${site()}/account` } });
  if (error) throw error;
}
export async function signOut() {
  const sb = await authClient();
  await sb.auth.signOut({ scope: "local" });
  set({ status: "signedOut", user: null, officials: [], bills: [] });
}

// Saved officials and bills. Each change is written, then the list re-read.
export async function saveOfficials(rows) {
  if (!rows.length) return;
  const sb = await authClient();
  const { error } = await sb.from("followed_officials").upsert(rows, { onConflict: "user_id,kind,official_id", ignoreDuplicates: true });
  if (error) throw error;
  await refreshSaved();
}
export async function removeOfficial(r) {
  const sb = await authClient();
  const { error } = await sb.from("followed_officials").delete().eq("kind", r.kind).eq("official_id", r.official_id);
  if (error) throw error;
  await refreshSaved();
}
export async function saveBill(r) {
  const sb = await authClient();
  const { error } = await sb.from("followed_bills").upsert([r], { onConflict: "user_id,congress,bill_type,number", ignoreDuplicates: true });
  if (error) throw error;
  await refreshSaved();
}
export async function removeBill(r) {
  const sb = await authClient();
  const { error } = await sb.from("followed_bills").delete().eq("congress", r.congress).eq("bill_type", r.bill_type).eq("number", r.number);
  if (error) throw error;
  await refreshSaved();
}

export async function loadPrefs() {
  const sb = await authClient();
  const { data, error } = await sb.from("account_prefs").select("language, weekly_digest, bill_updates, election_reminders, election_state, districts").maybeSingle();
  if (error) throw error;
  return data;
}
export async function updatePrefs(patch) {
  const sb = await authClient();
  const { error } = await sb.from("account_prefs").update(patch).eq("user_id", state.user.id);
  if (error) throw error;
}

export async function downloadMyData() {
  const sb = await authClient();
  const { data, error } = await sb.rpc("my_account_data");
  if (error) throw error;
  return data;
}

// Deletes the account and everything saved with it in the database, then this browser's session.
export async function deleteAccount() {
  const sb = await authClient();
  const { data, error } = await sb.rpc("delete_my_account");
  if (error) throw error;
  if (data !== true) throw new Error("The account could not be deleted.");
  await sb.auth.signOut({ scope: "local" }).catch(() => {});
  try { localStorage.removeItem(SESSION_KEY); } catch { /* storage off */ }
  set({ status: "signedOut", user: null, officials: [], bills: [], deleted: true });
}
