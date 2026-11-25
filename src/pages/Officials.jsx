import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import LookupResults from "../components/LookupResults.jsx";
import { useLang } from "../lib/i18n.jsx";

// Officials for a saved or shared set of districts (/officials?st=CA&cd=45&...). The link holds
// district numbers only; nothing here knows an address.
export default function Officials() {
  const { t } = useLang();
  const { search } = useLocation();
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    document.title = t("Elected officials · Civic Atlas", "Funcionarios electos · Civic Atlas");
    setResult(null); setError("");
    fetch(`/api/officials${search}`).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      setResult(body);
    }).catch(() => setError(t("This link couldn't be read. Look up an address instead.", "No se pudo leer este enlace. Busque una dirección.")));
  }, [search]);
  return (
    <main className="page wide">
      <h1>{t("Elected officials", "Funcionarios electos")}</h1>
      <p className="fine">{t("For the districts saved in this link. ", "Para los distritos guardados en este enlace. ")}<Link to="/">{t("Look up a different address", "Buscar otra dirección")}</Link></p>
      {error && <p className="notice">{error}</p>}
      {!result && !error && <p className="fine">{t("Loading…", "Cargando…")}</p>}
      {result && <LookupResults result={result} shared />}
    </main>
  );
}
