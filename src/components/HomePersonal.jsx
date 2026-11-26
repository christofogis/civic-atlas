import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { date, stateName } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { rest } from "../../lib/rest.js";
import { weekItems } from "../../lib/yourWeek.js";
import { PartyTag } from "./PartyTag.jsx";

// The top of the home page for someone who has looked up an address on this device: their members
// of Congress and the next few things coming up for them at every level, with a way into "Your
// week". The same template for everyone; built from saved district numbers, never an address.
const LEVEL = { congress: ["Congress", "Congreso"], state: ["State", "Estado"], county: ["County", "Condado"], city: ["City", "Ciudad"] };

export default function HomePersonal({ saved, onForget }) {
  const params = useMemo(() => new URLSearchParams(saved), [saved]);
  const [result, setResult] = useState(null);
  const [items, setItems] = useState(null);

  useEffect(() => {
    fetch(`/api/officials?${saved}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setResult).catch(() => setResult(false));
  }, [saved]);
  useEffect(() => {
    if (!result) return;
    const json = (path) => fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(path))));
    weekItems({ result, params, deps: { rest, json, tr } }).then(setItems).catch(() => setItems([]));
  }, [result, params]);

  const where = [params.get("pl"), stateName(params.get("st"))].filter(Boolean).join(", ");
  const people = result ? result.officials.filter((o) => o.seat_status !== "pending_update") : [];
  const next = (items ?? []).slice(0, 4);

  return (
    <div className="home-personal">
      {where && <p className="fine">{tr(`For ${where}`, `Para ${where}`)}</p>}
      <h1>{tr("Your officials", "Sus funcionarios")}</h1>
      {result === null && <p className="fine">{tr("Loading…", "Cargando…")}</p>}
      {people.length > 0 && (
        <ul className="bare rep-chips">
          {people.map((o) => (
            <li key={o.bioguide_id}>
              <Link to={`/member/${o.bioguide_id}`}>{o.name}</Link> <PartyTag p={o} />
              <span className="fine"> {o.chamber === "senate" ? tr("Senator", "Senado") : tr("Representative", "Representante")}</span>
            </li>
          ))}
        </ul>
      )}
      <h2>{tr("Coming up for you", "Lo que viene para usted")}</h2>
      {items === null ? <p className="fine">{tr("Loading…", "Cargando…")}</p> : next.length === 0 ? <p>{tr("Nothing scheduled in the next few weeks.", "Nada programado en las próximas semanas.")}</p> : (
        <ul className="bare next-up">
          {next.map((it) => (
            <li key={it.key}>
              <span className="next-date">{date(it.date)}</span>
              <span className="level-tag">{tr(...LEVEL[it.level])}</span>
              {it.to ? <Link to={it.to} className="clamp2">{it.text}</Link> : <span className="clamp2">{it.text}</span>}
            </li>
          ))}
        </ul>
      )}
      <p className="home-personal-actions">
        <Link className="button-primary" to="/your-week">{tr("See your week", "Ver su semana")}</Link>
        <Link to={`/officials?${saved}`}>{tr("All your officials: federal, state and local", "Todos sus funcionarios: federales, estatales y locales")}</Link>
      </p>
      <p className="fine">
        {tr("Remembered on this device from your last lookup (district numbers only, never your address). ", "Guardado en este dispositivo desde su última búsqueda (solo números de distrito, nunca su dirección). ")}
        <button type="button" className="link fine" onClick={onForget}>{tr("Forget it", "Olvidarlo")}</button>
      </p>
    </div>
  );
}
