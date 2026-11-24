import { useState } from "react";

// "Embed on your site": iframe code a news site can paste into an article.
export default function EmbedCode({ path, title, height = 520 }) {
  const [copied, setCopied] = useState(false);
  const code = `<iframe src="${window.location.origin}${path}" title="${title.replace(/"/g, "&quot;")}" width="100%" height="${height}" style="border:0;max-width:640px" loading="lazy"></iframe>`;
  return (
    <details className="embed-code fine">
      <summary>Embed this record on your site</summary>
      <p>Paste this where the card should appear. It updates as the record does and links back here for the full record.</p>
      <textarea readOnly rows={3} value={code} onFocus={(e) => e.target.select()} style={{ width: "100%" }} aria-label="Embed code" />
      <button type="button" className="link fine" onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied(true))}>{copied ? "Copied" : "Copy code"}</button>
    </details>
  );
}
