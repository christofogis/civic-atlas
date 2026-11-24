import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { GLOSSARY } from "../lib/glossary.js";

export default function Glossary() {
  const { hash } = useLocation();
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView(); }, [hash]);
  const entries = Object.entries(GLOSSARY).sort((a, z) => a[1].term.localeCompare(z[1].term));
  return (
    <main className="page">
      <h1>Glossary</h1>
      <p className="lede">What the terms on this site mean, in plain language.</p>
      <dl className="glossary">
        {entries.map(([id, g]) => (
          <div key={id} id={id}>
            <dt>{g.term}</dt>
            <dd>{g.text}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
