import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../lib/i18n.jsx";
import { db } from "../lib/db.js";
import { ACCOUNTS_ENABLED, AUTH_GOOGLE_ENABLED } from "../lib/config.js";
import { STATE_NAMES, stateName } from "../lib/format.js";
import {
  useAccount, startAuth, sendEmailLink, verifyEmailCode, signInWithGoogle, signOut, saveOfficials, removeOfficial,
  removeBill, loadPrefs, updatePrefs, downloadMyData, deleteAccount,
} from "../lib/auth.js";
import { officialsToSync, officialKey, billKey, billPath, cleanDistricts, districtsState, emailChoice, exportFileName, looksLikeEmail, cleanCode } from "../lib/account.js";
import { myRepresentatives, rememberRepresentatives } from "../lib/myReps.js";
import { savedDistricts } from "../lib/savedDistricts.js";

// Optional account: sign in with an email link (or Google, once set up), keep saved officials and
// bills across devices, choose emails. Nothing on the site needs it.
export default function Account() {
  const { t } = useLang();
  const account = useAccount();
  useEffect(() => { startAuth(); }, []);

  if (!ACCOUNTS_ENABLED) {
    return (
      <main className="page account">
        <h1>{t("Your account", "Su cuenta")}</h1>
        <p>{t("Accounts aren't open yet. Everything on this site works without one.", "Las cuentas aún no están disponibles. Todo en este sitio funciona sin una.")}</p>
      </main>
    );
  }
  return (
    <main className="page account">
      <h1>{t("Your account", "Su cuenta")}</h1>
      {account.status === "signedIn" ? <SignedIn account={account} /> : account.status === "signedOut" ? <>
        {account.deleted && <p className="notice-box" role="status">{t("Your account and everything saved with it were deleted.", "Su cuenta y todo lo guardado con ella se eliminaron.")}</p>}
        <SignIn /></> : <p>{t("Loading…", "Cargando…")}</p>}
      <p className="fine">
        {t("What an account stores, and how to delete it: ", "Qué guarda una cuenta y cómo eliminarla: ")}
        <Link to="/methods#accounts">{t("How this site works", "Cómo funciona este sitio")}</Link>.
      </p>
    </main>
  );
}

function SignIn() {
  const { t, lang } = useLang();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");   // email | sending | sent | verifying
  const [error, setError] = useState("");
  // An error the auth server sent back in the link (for example an expired link).
  const linkError = useMemo(() => new URLSearchParams(window.location.search).get("error_description"), []);

  async function send(e) {
    e.preventDefault();
    if (!looksLikeEmail(email)) { setError(t("Enter an email address.", "Escriba un correo electrónico.")); return; }
    setError(""); setStep("sending");
    try { await sendEmailLink(email, lang); setStep("sent"); }
    catch (err) {
      setStep("email");
      setError(err?.status === 429
        ? t("Too many sign-in emails were sent just now. Please try again in a few minutes.", "Se enviaron demasiados correos de inicio de sesión. Inténtelo de nuevo en unos minutos.")
        : t("The sign-in email couldn't be sent. Please try again later.", "No se pudo enviar el correo de inicio de sesión. Inténtelo más tarde."));
    }
  }
  async function verify(e) {
    e.preventDefault();
    setError(""); setStep("verifying");
    try { await verifyEmailCode(email, cleanCode(code)); }
    catch { setStep("sent"); setError(t("That code didn't work. Check it, or send a new email.", "Ese código no funcionó. Revíselo o envíe un correo nuevo.")); }
  }

  return (
    <>
      <p className="lede">{t("An account is optional. Everything on this site works without one.", "La cuenta es opcional. Todo en este sitio funciona sin una.")}</p>
      <p>{t("With an account you can save officials and bills and see them on any device, and choose which email updates you want. It stores your email address and what you choose to save, never your street address.",
        "Con una cuenta puede guardar funcionarios y proyectos de ley y verlos en cualquier dispositivo, y elegir qué actualizaciones por correo desea. Guarda su correo electrónico y lo que usted decida guardar, nunca su dirección.")}</p>
      {linkError && <p className="notice-box" role="alert">{t("That sign-in link didn't work (it may have expired). Please send a new one.", "Ese enlace de inicio de sesión no funcionó (puede haber vencido). Envíe uno nuevo.")}</p>}

      {step === "email" || step === "sending" ? (
        <form onSubmit={send} className="account-form">
          <label htmlFor="account-email">{t("Email address", "Correo electrónico")}</label>
          <div className="row">
            <input id="account-email" type="email" autoComplete="email" inputMode="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button type="submit" disabled={step === "sending"}>{step === "sending" ? t("Sending…", "Enviando…") : t("Email me a sign-in link", "Enviarme un enlace")}</button>
          </div>
          <p className="fine">{t("No password. We email you a link and a code; either one signs you in. A new account is created the first time.", "Sin contraseña. Le enviamos un enlace y un código; cualquiera de los dos inicia la sesión. La primera vez se crea una cuenta nueva.")}</p>
        </form>
      ) : (
        <form onSubmit={verify} className="account-form">
          <p role="status">{t(`Check your email (${email.trim()}). Open the link on this device, or type the code here.`, `Revise su correo (${email.trim()}). Abra el enlace en este dispositivo o escriba el código aquí.`)}</p>
          <label htmlFor="account-code">{t("Code from the email", "Código del correo")}</label>
          <div className="row">
            <input id="account-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} value={code} onChange={(e) => setCode(cleanCode(e.target.value))} />
            <button type="submit" disabled={step === "verifying" || code.length < 6}>{step === "verifying" ? t("Checking…", "Verificando…") : t("Sign in", "Iniciar sesión")}</button>
          </div>
          <p className="fine"><button type="button" className="link" onClick={() => { setStep("email"); setCode(""); }}>{t("Use a different email or send again", "Usar otro correo o enviar de nuevo")}</button></p>
        </form>
      )}
      {error && <p className="notice-box" role="alert">{error}</p>}

      {AUTH_GOOGLE_ENABLED && (
        <p className="account-google">
          <button type="button" className="button-outline" onClick={() => signInWithGoogle().catch(() => setError(t("Google sign-in couldn't start. Please try again later.", "No se pudo iniciar sesión con Google. Inténtelo más tarde.")))}>
            {t("Sign in with Google", "Iniciar sesión con Google")}
          </button>
        </p>
      )}
    </>
  );
}

function SignedIn({ account }) {
  const { t } = useLang();
  const [prefs, setPrefs] = useState(null);
  const [prefsError, setPrefsError] = useState(false);
  const [saved, setSaved] = useState("");
  useEffect(() => { loadPrefs().then(setPrefs).catch(() => setPrefsError(true)); }, [account.user.id]);

  async function change(patch) {
    const before = prefs;
    setPrefs({ ...prefs, ...patch }); setSaved("");
    try { await updatePrefs(patch); setSaved(t("Saved.", "Guardado.")); }
    catch { setPrefs(before); setSaved(t("Couldn't save that change. Please try again.", "No se pudo guardar el cambio. Inténtelo de nuevo.")); }
  }

  return (
    <>
      <p>
        {t("Signed in as ", "Sesión iniciada como ")}<strong>{account.user.email}</strong>.{" "}
        <button type="button" className="link" onClick={() => signOut()}>{t("Sign out", "Cerrar sesión")}</button>
      </p>
      <SavedOfficials account={account} />
      <SavedBills account={account} />
      <Districts prefs={prefs} change={change} />

      <h2 id="emails">{t("Email updates", "Actualizaciones por correo")}</h2>
      <p className="notice-box">{t("Email updates start soon; you can choose them now. Nothing is sent yet.", "Las actualizaciones por correo comenzarán pronto; puede elegirlas ahora. Todavía no se envía nada.")}</p>
      {prefsError && <p className="notice-box" role="alert">{t("Your email choices couldn't be loaded. Please try again later.", "No se pudieron cargar sus opciones de correo. Inténtelo más tarde.")}</p>}
      {prefs && (
        <fieldset className="account-prefs">
          <legend className="visually-hidden">{t("Choose email updates", "Elija actualizaciones por correo")}</legend>
          <label><input type="checkbox" checked={prefs.weekly_digest} onChange={(e) => change(emailChoice("weekly_digest", e.target.checked))} />
            {" "}{t("Weekly: how my saved officials voted", "Semanal: cómo votaron mis funcionarios guardados")}</label>
          <label><input type="checkbox" checked={prefs.bill_updates} onChange={(e) => change(emailChoice("bill_updates", e.target.checked))} />
            {" "}{t("When a saved bill has a new action", "Cuando un proyecto guardado tenga una nueva acción")}</label>
          <label><input type="checkbox" checked={prefs.election_reminders} onChange={(e) => change(emailChoice("election_reminders", e.target.checked))} />
            {" "}{t("Election dates for my state", "Fechas de elecciones de mi estado")}</label>
          <label className="account-sub">{t("State", "Estado")}{" "}
            <select value={prefs.election_state ?? ""} onChange={(e) => change({ election_state: e.target.value || null })}>
              <option value="">{t("Choose a state", "Elija un estado")}</option>
              {Object.keys(STATE_NAMES).map((st) => <option key={st} value={st}>{stateName(st)}</option>)}
            </select>
          </label>
          <div className="account-lang" role="radiogroup" aria-label={t("Email language", "Idioma de los correos")}>
            {t("Email language", "Idioma de los correos")}:{" "}
            <label><input type="radio" name="email-lang" checked={prefs.language === "en"} onChange={() => change({ language: "en" })} /> English</label>{" "}
            <label><input type="radio" name="email-lang" checked={prefs.language === "es"} onChange={() => change({ language: "es" })} /> Español</label>
          </div>
          <p className="fine">{t("All are off until you turn them on. Each email will have a link to stop it, no sign-in needed. When you turn one on or off, the time is recorded.",
            "Todas están desactivadas hasta que usted las active. Cada correo tendrá un enlace para dejar de recibirlo, sin iniciar sesión. Cuando activa o desactiva una, se registra la hora.")}</p>
          {saved && <p className="fine" role="status">{saved}</p>}
        </fieldset>
      )}

      <YourData />
    </>
  );
}

function SavedOfficials({ account }) {
  const { t } = useLang();
  const [names, setNames] = useState({});
  const [busy, setBusy] = useState(false);
  const toSync = officialsToSync([...myRepresentatives()], account.officials);
  const ids = account.officials.map(officialKey).join("|");
  useEffect(() => {
    const members = account.officials.filter((o) => o.kind === "member").map((o) => o.official_id);
    const state = account.officials.filter((o) => o.kind === "state").map((o) => o.official_id);
    Promise.all([
      members.length ? db.from("members").select("bioguide_id,official_full_name,first_name,last_name").in("bioguide_id", members) : { data: [] },
      state.length ? db.from("state_people").select("id,name").in("id", state) : { data: [] },
    ]).then(([m, s]) => {
      const n = {};
      for (const r of m.data ?? []) n[`member:${r.bioguide_id}`] = r.official_full_name ?? `${r.first_name} ${r.last_name}`;
      for (const r of s.data ?? []) n[`state:${r.id}`] = r.name;
      setNames(n);
    }).catch(() => {});
  }, [ids]);
  const localMembers = [...myRepresentatives()];
  const onDevice = new Set(localMembers);
  const accountMembers = account.officials.filter((o) => o.kind === "member").map((o) => o.official_id);
  const canUseHere = accountMembers.length > 0 && accountMembers.some((id) => !onDevice.has(id)) && localMembers.length === 0;

  return (
    <>
      <h2>{t("Saved officials", "Funcionarios guardados")}</h2>
      {toSync.length > 0 && (
        <p className="notice-box">
          {t(`Your last lookup on this device found ${toSync.length} official${toSync.length === 1 ? "" : "s"} not saved to your account. `,
            `Su última búsqueda en este dispositivo encontró ${toSync.length} funcionario${toSync.length === 1 ? "" : "s"} que no están en su cuenta. `)}
          <button type="button" className="link" disabled={busy} onClick={async () => { setBusy(true); await saveOfficials(toSync).catch(() => {}); setBusy(false); }}>
            {t("Save them to my account", "Guardarlos en mi cuenta")}</button>
        </p>
      )}
      {canUseHere && (
        <p className="notice-box">
          {t("This device has no saved lookup. ", "Este dispositivo no tiene una búsqueda guardada. ")}
          <button type="button" className="link" onClick={() => { rememberRepresentatives(accountMembers); window.location.reload(); }}>
            {t("Show my saved members of Congress on this device", "Mostrar mis miembros del Congreso guardados en este dispositivo")}</button>
        </p>
      )}
      {account.officials.length === 0 ? (
        <p className="fine-plain">{t("None yet. Use “Save” on an official's page, or look up your address on the home page.", "Ninguno todavía. Use “Guardar” en la página de un funcionario o busque su dirección en la página principal.")}</p>
      ) : (
        <ul className="plain account-list">
          {account.officials.map((o) => (
            <li key={officialKey(o)}>
              <Link to={o.kind === "member" ? `/member/${o.official_id}` : `/state/person/${encodeURIComponent(o.official_id)}`}>{names[officialKey(o)] ?? o.official_id}</Link>
              {" "}<button type="button" className="link fine" onClick={() => removeOfficial(o).catch(() => {})}>{t("Remove", "Quitar")}</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function SavedBills({ account }) {
  const { t } = useLang();
  const [titles, setTitles] = useState({});
  const ids = account.bills.map(billKey).join("|");
  useEffect(() => {
    if (!account.bills.length) return;
    const or = account.bills.slice(0, 100).map((b) => `and(congress.eq.${b.congress},bill_type.eq.${b.bill_type},number.eq.${b.number})`).join(",");
    db.from("bills").select("congress,bill_type,number,title,short_title").or(or)
      .then(({ data }) => setTitles(Object.fromEntries((data ?? []).map((b) => [billKey(b), b.short_title ?? b.title]))))
      .catch(() => {});
  }, [ids]);
  const label = (b) => `${{ hr: "H.R.", s: "S.", hjres: "H.J.Res.", sjres: "S.J.Res.", hconres: "H.Con.Res.", sconres: "S.Con.Res.", hres: "H.Res.", sres: "S.Res." }[b.bill_type]} ${b.number}`;
  return (
    <>
      <h2>{t("Saved bills", "Proyectos de ley guardados")}</h2>
      {account.bills.length === 0 ? (
        <p className="fine-plain">{t("None yet. Use “Save” on a bill's page.", "Ninguno todavía. Use “Guardar” en la página de un proyecto de ley.")}</p>
      ) : (
        <ul className="plain account-list">
          {account.bills.map((b) => (
            <li key={billKey(b)}>
              <Link to={billPath(b)}>{label(b)}</Link> <span className="fine-plain">({b.congress}{t("th Congress", ".º Congreso")})</span>
              {titles[billKey(b)] && <> {titles[billKey(b)]}</>}
              {" "}<button type="button" className="link fine" onClick={() => removeBill(b).catch(() => {})}>{t("Remove", "Quitar")}</button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// The districts from a lookup (state and district numbers, never the address), kept with the account
// so another device can show "Your week" and "All your officials" without a new lookup.
function Districts({ prefs, change }) {
  const { t } = useLang();
  if (!prefs) return null;
  const here = cleanDistricts(savedDistricts());
  const there = cleanDistricts(prefs.districts);
  return (
    <>
      <h2>{t("Saved districts", "Distritos guardados")}</h2>
      <p className="fine-plain">{t("Only the state and district numbers from a lookup, never the address.", "Solo el estado y los números de distrito de una búsqueda, nunca la dirección.")}</p>
      {there ? (
        <p>
          {t("Saved: ", "Guardados: ")}{stateName(districtsState(there))}{" · "}
          <Link to={`/officials?${there}`}>{t("All your officials", "Todos sus funcionarios")}</Link>{" · "}
          {here !== there && <><button type="button" className="link" onClick={() => { try { localStorage.setItem("civic-atlas:my-districts", there); } catch { /* storage off */ } window.location.reload(); }}>{t("Use them on this device", "Usarlos en este dispositivo")}</button>{" · "}</>}
          <button type="button" className="link" onClick={() => change({ districts: null })}>{t("Remove", "Quitar")}</button>
        </p>
      ) : <p className="fine-plain">{t("None saved.", "Ninguno guardado.")}</p>}
      {here && here !== there && (
        <p><button type="button" className="link" onClick={() => change({ districts: here, ...(prefs.election_state ? {} : { election_state: districtsState(here) }) })}>
          {t(`Save this device's districts (${stateName(districtsState(here))}) to my account`, `Guardar en mi cuenta los distritos de este dispositivo (${stateName(districtsState(here))})`)}</button></p>
      )}
    </>
  );
}

function YourData() {
  const { t } = useLang();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState("");

  async function download() {
    setStatus("");
    try {
      const data = await downloadMyData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: exportFileName() });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setStatus(t("Your data couldn't be downloaded. Please try again later.", "No se pudieron descargar sus datos. Inténtelo más tarde.")); }
  }
  async function remove() {
    setStatus(t("Deleting…", "Eliminando…"));
    try { await deleteAccount(); setStatus(""); setConfirming(false); }
    catch { setStatus(t("The account couldn't be deleted. Please try again later.", "No se pudo eliminar la cuenta. Inténtelo más tarde.")); }
  }

  return (
    <>
      <h2>{t("Your data", "Sus datos")}</h2>
      <p><button type="button" className="link" onClick={download}>{t("Download my data", "Descargar mis datos")}</button>
        <span className="fine-plain"> {t("(everything stored for this account, as a JSON file)", "(todo lo guardado para esta cuenta, en un archivo JSON)")}</span></p>
      {!confirming ? (
        <p><button type="button" className="link" onClick={() => setConfirming(true)}>{t("Delete my account", "Eliminar mi cuenta")}</button></p>
      ) : (
        <div className="notice-box" role="alertdialog" aria-labelledby="delete-q">
          <p id="delete-q">{t("This deletes your account, your saved officials, bills and districts, your email choices and their record. It can't be undone. What this device remembers on its own (your last lookup) stays until you clear it.",
            "Esto elimina su cuenta, sus funcionarios, proyectos y distritos guardados, sus opciones de correo y su registro. No se puede deshacer. Lo que este dispositivo recuerda por su cuenta (su última búsqueda) se queda hasta que usted lo borre.")}</p>
          <div className="row-inline">
            <button type="button" className="button-danger" onClick={remove}>{t("Delete my account", "Eliminar mi cuenta")}</button>
            <button type="button" className="link" onClick={() => setConfirming(false)}>{t("Cancel", "Cancelar")}</button>
          </div>
        </div>
      )}
      {status && <p className="fine" role="status">{status}</p>}
    </>
  );
}
