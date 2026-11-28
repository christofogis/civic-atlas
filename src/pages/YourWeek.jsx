import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { date, stateName } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { savedDistricts } from "../lib/savedDistricts.js";
import { rest } from "../../lib/rest.js";
import { clock, weekIcs, weekItems } from "../../lib/yourWeek.js";
import MyReps from "../components/MyReps.jsx";
import { StatePartyTag, statePersonPath } from "../components/StateOfficialCard.jsx";
import { NotesList, Ref } from "../components/Notes.jsx";
import { nextElection } from "../../lib/measures.js";

// "Your week": everything coming up for the officials from the visitor's last lookup, at every
// level, on one list (and as a calendar file), followed by what their members of Congress did in
// the last seven days. Built from the districts remembered on this device; never an address.
// Every visitor gets the same template: the same kinds of items, worded the same way.

const showTime = (t) => { const c = clock(t); if (!c) return ""; const [h, m] = c; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`; };

export default function YourWeek() {
  // Districts from the link (shareable, bookmarkable) or else from this device's last lookup.
  const fromLink = new URLSearchParams(window.location.search);
  fromLink.delete("lang");
  const saved = fromLink.get("st") ? fromLink.toString() : savedDistricts();
  const params = useMemo(() => new URLSearchParams(saved ?? ""), [saved]);
  const [result, setResult] = useState(null);
  const [items, setItems] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!saved) return;
    fetch(`/api/officials?${saved}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setResult).catch(() => setResult(false));
  }, [saved]);

  useEffect(() => {
    if (!result) return;
    const json = (path) => fetch(path).then((r) => (r.ok ? r.json() : Promise.reject(new Error(path))));
    weekItems({ result, params, deps: { rest, json, tr } }).then(setItems).catch(() => setItems([]));
  }, [result, params]);

  const [election, setElection] = useState(null);
  useEffect(() => {
    if (params.get("st") === "CA") fetch("/data/measures/ca-2028.json").then((r) => r.json()).then((m) => setElection(nextElection(m, new Date().toISOString().slice(0, 10))?.date ?? null)).catch(() => {});
  }, [params]);

  if (!saved) {
    return (
      <main className="page">
        <h1>{tr("Your week", "Su semana")}</h1>
        <p className="lede">{tr("Look up your address once, and this page lists what's coming up for your officials at every level, from Congress to your city council, and what your members of Congress did in the last seven days.", "Busque su dirección una vez y esta página mostrará lo que viene para sus funcionarios en todos los niveles, del Congreso a su concejo municipal, y lo que hicieron sus miembros del Congreso en los últimos siete días.")}</p>
        <p><Link className="button-primary" to="/">{tr("Look up your address", "Buscar su dirección")}</Link></p>
        <p className="fine">{tr("Only your district numbers are kept, on this device. Your address is never stored.", "Solo se guardan los números de sus distritos, en este dispositivo. Su dirección nunca se guarda.")}</p>
      </main>
    );
  }

  const where = [params.get("pl"), stateName(params.get("st"))].filter(Boolean).join(", ");
  const LEVEL = { congress: ["Congress", "Congreso"], state: ["State", "Estado"], county: ["County", "Condado"], city: ["City", "Ciudad"] };
  const byDay = (items ?? []).reduce((m, it) => m.set(it.date, [...(m.get(it.date) ?? []), it]), new Map());
  const download = () => {
    const blob = new Blob([weekIcs({ items, origin: window.location.origin, name: tr("Your officials' calendar (Civic Atlas)", "Calendario de sus funcionarios (Civic Atlas)") })], { type: "text/calendar" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "civic-atlas-your-week.ics" });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  // A calendar subscription: the phone re-reads the feed every few hours, so new hearings and
  // agendas appear on their own. webcal:// opens the calendar app's subscribe screen.
  const feed = `${window.location.host}/api/calendar/week?${saved}${tr("", "&lang=es") }`;
  const ids = result ? result.officials.map((o) => o.bioguide_id) : [];
  const legislators = result ? (result.state_officials ?? []).filter((o) => ["upper", "lower", "legislature"].includes(o.type) && !o.updating) : [];

  return (
    <main className="page wide your-week">
        <h1>{tr("Your week", "Su semana")}</h1>
        <p className="lede">
          {where && <>{tr(`For ${where}.`, `Para ${where}.`)} </>}
          <Link to={`/officials?${saved}`}>{tr("All your officials", "Todos sus funcionarios")}</Link>
          {" · "}<Link to={`/your-week?${saved}`}>{tr("Link to this page", "Enlace a esta página")}</Link>
          {" · "}<Link to="/">{tr("Look up another address", "Buscar otra dirección")}</Link>
        </p>
        {/* The calendar comes first and can run long; this gets straight to what already happened. */}
        <p><a href="#last-7-days">{tr("Skip to what your members of Congress did in the last 7 days", "Ir a lo que hicieron sus miembros del Congreso en los últimos 7 días")}</a></p>
        {result === false && <p className="notice">{tr("Your officials didn't load. Reload the page to try again.", "Sus funcionarios no se cargaron. Vuelva a cargar la página.")}</p>}

        <section>
          <h2>{tr("Coming up", "Próximamente")}<Ref id="sources" text={tr("Congress: committee and floor schedules from the House and Senate, matched to the committees your members of Congress sit on. California: the state constitution (the Legislature convenes the first Monday of December in even-numbered years) and the Secretary of State. County and city: the Board of Supervisors' adopted schedule and the city's meeting rule; special meetings and cancellations are posted on each agenda page. Times are local to where the meeting is held.", "Congreso: agendas de comités y del pleno de la Cámara y el Senado, según los comités en que están sus miembros del Congreso. California: la constitución estatal (la Legislatura se reúne el primer lunes de diciembre de los años pares) y el Secretario de Estado. Condado y ciudad: el calendario adoptado por la Junta de Supervisores y la regla de reuniones de la ciudad; las reuniones especiales y cancelaciones se publican en cada página de agenda. Las horas son las del lugar de la reunión.")} /></h2>
          {items === null ? <p>{tr("Loading…", "Cargando…")}</p> : items.length === 0 ? <p>{tr("Nothing on the calendar in the next 45 days.", "Nada en el calendario en los próximos 45 días.")}</p> : (
            <>
              <ul className="agenda">
                {[...byDay].map(([d, list]) => (
                  <li key={d}>
                    <h3 className="agenda-day">{date(d)}</h3>
                    <ul>
                      {list.map((it) => (
                        <li key={it.key}>
                          <span className="level-tag">{tr(...LEVEL[it.level])}</span>{" "}
                          {it.time && <span className="fine">{showTime(it.time)}{it.tz === "America/New_York" ? tr(" Eastern", " (hora del Este)") : ""} · </span>}
                          {it.to ? <Link to={it.to} className="clamp2">{it.text}</Link> : it.url ? <a href={it.url} rel="noopener" className="clamp2">{it.text}</a> : it.text}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <div className="subscribe">
                <a className="button-primary" href={`webcal://${feed}`}>{tr("Subscribe in your calendar", "Suscribirse en su calendario")}</a>
                <p className="fine">{tr("Your phone's calendar keeps this list up to date on its own: new hearings, agendas and meetings appear as they're posted, and each event links back here. The link holds only your district numbers.", "El calendario de su teléfono mantiene esta lista al día por sí solo: las nuevas audiencias, agendas y reuniones aparecen cuando se publican, y cada evento enlaza aquí. El enlace solo contiene los números de sus distritos.")}</p>
                <ul className="bare fine">
                  <li><button type="button" className="link" onClick={() => { navigator.clipboard?.writeText(`https://${feed}`).then(() => setCopied(true)); }}>{copied ? tr("Link copied", "Enlace copiado") : tr("Copy the link", "Copiar el enlace")}</button> {tr("(for Google Calendar: Other calendars, then From URL)", "(para Google Calendar: Otros calendarios, luego Desde URL)")}</li>
                  <li><button type="button" className="link" onClick={download}>{tr("Download once instead", "Descargar una vez")}</button></li>
                </ul>
              </div>
            </>
          )}
          {election && <p>{tr("Next statewide election:", "Próxima elección estatal:")} <strong>{date(election)}</strong> · <Link to="/measures">{tr("Ballot measures so far", "Medidas en la boleta hasta ahora")}</Link></p>}
        </section>

        <section id="last-7-days">
          <h2>{tr("Your members of Congress: the last 7 days", "Sus miembros del Congreso: los últimos 7 días")}</h2>
          {result && <MyReps ids={ids} embedded />}
        </section>

        {legislators.length > 0 && (
          <section>
            <h2>{tr(`Your ${stateName(result.state)} legislators`, `Sus legisladores de ${stateName(result.state)}`)}</h2>
            <ul className="plain">
              {legislators.map((o) => <li key={o.id ?? o.name}>{o.id ? <Link to={statePersonPath(o.id)}>{o.name}</Link> : o.name}{o.party && <> <StatePartyTag party={o.party} /></>}</li>)}
            </ul>
            <p className="fine">{tr("State legislators' votes and bills aren't on Civic Atlas yet.", "Los votos y proyectos de los legisladores estatales aún no están en Civic Atlas.")}</p>
          </section>
        )}
        <NotesList />
    </main>
  );
}
