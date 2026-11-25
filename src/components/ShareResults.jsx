import { useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../lib/i18n.jsx";
import { officialsPath } from "../lib/savedDistricts.js";

// A link to these results that holds only district numbers, never the address.
export default function ShareResults({ result }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  const path = officialsPath(result);
  const url = `${window.location.origin}${path}`;
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: t("My elected officials", "Mis funcionarios electos"), url }); return; } catch { /* cancelled; fall back to copy */ }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* no clipboard */ }
  }
  return (
    <div className="share-results">
      <p>
        <strong>{t("Save or share this list", "Guarde o comparta esta lista")}</strong>{" "}
        <span className="fine">{t("The link holds your districts, not your address.", "El enlace guarda sus distritos, no su dirección.")}</span>
      </p>
      <p className="share-actions">
        <button type="button" className="button-secondary" onClick={share}>{copied ? t("Link copied", "Enlace copiado") : t("Copy or share link", "Copiar o compartir enlace")}</button>
        <Link to={path}>{t("Open as its own page", "Abrir como página")}</Link>
      </p>
    </div>
  );
}
