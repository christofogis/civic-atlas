import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { GLOSSARY } from "../lib/glossary.js";
import { useLang } from "../lib/i18n.jsx";

export default function Glossary() {
  const { hash } = useLocation();
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView(); }, [hash]);
  const { t, lang } = useLang();
  const term = (g) => t(g.term, g.term_es);
  const entries = Object.entries(GLOSSARY).sort((a, z) => term(a[1]).localeCompare(term(z[1]), lang));
  return (
    <main className="page">
      <h1>{t("Glossary", "Glosario")}</h1>
      <p className="lede">{t("What the terms on this site mean, in plain language.", "Qué significan los términos de este sitio, en lenguaje sencillo.")}</p>
      <dl className="glossary">
        {entries.map(([id, g]) => (
          <div key={id} id={id}>
            <dt>{term(g)}</dt>
            <dd>{t(g.text, g.text_es)}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
