import { useState } from "react";
import { tr } from "../lib/lang.js";

// "Embed on your site": iframe code a news site can paste into an article.
export default function EmbedCode({ path, title, height = 900 }) {
  const [copied, setCopied] = useState(false);
  const code = `<iframe src="${window.location.origin}${path}" title="${title.replace(/"/g, "&quot;")}" width="100%" height="${height}" style="border:0;max-width:640px" loading="lazy"></iframe>`;
  return (
    <details className="embed-code fine">
      <summary>{tr("Embed this record on your site", "Insertar este registro en su sitio web")}</summary>
      <p>{tr("Paste this where the card should appear. It updates as the record does and links back here for the full record.", "Pegue esto donde debe aparecer la tarjeta. Se actualiza con el registro y enlaza aquí para el registro completo.")}</p>
      <textarea readOnly rows={3} value={code} onFocus={(e) => e.target.select()} style={{ width: "100%" }} aria-label={tr("Embed code", "Código para insertar")} />
      <button type="button" className="link fine" onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied(true))}>{copied ? tr("Copied", "Copiado") : tr("Copy code", "Copiar código")}</button>
    </details>
  );
}
