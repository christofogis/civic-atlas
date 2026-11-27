import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useLang } from "../lib/i18n.jsx";
import { db } from "../lib/db.js";
import { unsubscribeParams } from "../lib/account.js";

// The page an email's "Unsubscribe" link opens. No sign-in. It asks before changing anything,
// because mail scanners open links on their own; one press turns the email off.
export default function Unsubscribe() {
  const { t } = useLang();
  const { search } = useLocation();
  const navigate = useNavigate();
  const p = useMemo(() => unsubscribeParams(search), [search]);
  const [status, setStatus] = useState("idle");
  const what = {
    weekly_digest: t("the weekly email about your saved officials' votes", "el correo semanal sobre los votos de sus funcionarios guardados"),
    bill_updates: t("emails about your saved bills", "los correos sobre sus proyectos guardados"),
    election_reminders: t("election date emails", "los correos con fechas de elecciones"),
    all: t("all emails from Civic Atlas", "todos los correos de Civic Atlas"),
  };
  async function stop() {
    setStatus("sending");
    const { error } = await db.rpc("unsubscribe_email", { token: p.token, kind: p.kind });
    setStatus(error ? "error" : "done");
  }
  return (
    <main className="page">
      <h1>{t("Unsubscribe", "Cancelar suscripción")}</h1>
      {!p ? (
        <p>{t("This unsubscribe link isn't complete. Copy the whole link from the email, or sign in and change your choices on your account page.", "Este enlace no está completo. Copie el enlace entero del correo, o inicie sesión y cambie sus opciones en la página de su cuenta.")}</p>
      ) : status === "done" ? (
        <p role="status">{t(`Done. You won't get ${what[p.kind]}.`, `Listo. No recibirá ${what[p.kind]}.`)}</p>
      ) : (
        <>
          <p>{t(`Stop ${what[p.kind]}?`, `¿Dejar de recibir ${what[p.kind]}?`)}</p>
          <div className="row-inline">
            <button type="button" className="button-outline" disabled={status === "sending"} onClick={stop}>{t("Unsubscribe", "Cancelar suscripción")}</button>
            {p.kind !== "all" && <button type="button" className="link" onClick={() => navigate(`/unsubscribe?t=${p.token}&k=all`, { replace: true })}>{t("Stop all emails instead", "Dejar de recibir todos los correos")}</button>}
          </div>
          {status === "error" && <p className="notice-box" role="alert">{t("That didn't work right now. Please try again later.", "No funcionó en este momento. Inténtelo más tarde.")}</p>}
        </>
      )}
      <p className="fine"><Link to="/account">{t("Your account", "Su cuenta")}</Link></p>
    </main>
  );
}
