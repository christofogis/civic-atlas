import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/db.js";
import { date, stateName } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { stateOfficeLabel } from "../lib/stateOffices.js";
import { StatePartyTag } from "../components/StateOfficialCard.jsx";
import { NotesList, Ref } from "../components/Notes.jsx";

// A state legislator or statewide official: current office, contact details, past roles.
// Data: Open States (openstates/people, public domain), compiled from state legislature sites.
const today = new Date().toISOString().slice(0, 10);
const current = (r) => (!r.start_date || r.start_date <= today) && (!r.end_date || r.end_date >= today);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

export default function StatePerson() {
  const { id } = useParams();
  const [p, setP] = useState(undefined);
  const [roles, setRoles] = useState([]);
  useEffect(() => {
    const pid = `ocd-person/${id}`;
    db.from("state_people").select("*").eq("id", pid).maybeSingle().then(({ data }) => {
      setP(data ?? null);
      if (data) document.title = `${data.name} · Civic Atlas`;
    });
    db.from("state_roles").select("type,district,start_date,end_date").eq("person_id", pid)
      .order("start_date", { ascending: false, nullsFirst: false }).then(({ data }) => setRoles(data ?? []));
  }, [id]);

  if (p === undefined) return <main className="page"><p className="fine">{tr("Loading…", "Cargando…")}</p></main>;
  if (p === null) return <main className="page"><h1>{tr("Official not found", "Funcionario no encontrado")}</h1><p><Link to="/">{tr("Look up your address", "Buscar su dirección")}</Link></p></main>;

  const now = roles.filter(current), upcoming = roles.filter((r) => r.start_date && r.start_date > today), past = roles.filter((r) => r.end_date && r.end_date < today);
  return (
    <main className="page wide">
      <p className="fine"><Link to="/">{tr("Home", "Inicio")}</Link> / {stateName(p.state)}</p>
      <header className={p.image_url ? "page-head member-head" : "page-head"}>
      {p.image_url && <img className="member-photo" src={p.image_url} alt={p.name} width="90" height="110" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} />}
      <h1>{p.name}<Ref id="src" text={<>
        {tr("Source: ", "Fuente: ")}<a href={`https://github.com/openstates/people/tree/main/data/${p.state.toLowerCase()}`} rel="noopener">Open States</a>
        {tr(" (public domain), compiled from state legislature and government websites; the photo, where shown, is the official one it links to, loaded from that website. Sources it lists: ", " (dominio público), recopilado de los sitios web de las legislaturas y gobiernos estatales; la foto, cuando aparece, es la oficial que enlaza, cargada desde ese sitio. Fuentes que cita: ")}
        {[...new Map(p.sources.map((u) => [host(u), u])).values()].map((u, i) => <span key={u}>{i ? ", " : ""}<a href={u} rel="noopener">{host(u)}</a></span>)}.
      </>} /></h1>
      <p className="meta"><StatePartyTag party={p.party} /> {p.party}{!p.active && <> · {tr("No longer in office", "Ya no ocupa el cargo")}</>}</p>
      </header>
      <div className="split">
        <div className="split-main">
          <h2>{tr("Office", "Cargo")}</h2>
          {now.length ? now.map((r) => (
            <p key={`${r.type}${r.district}`} className="map-rep">{stateOfficeLabel(r, p.state)}{r.start_date && <span className="fine"> · {tr("since", "desde el")} {date(r.start_date)}</span>}{r.end_date && <span className="fine"> · {tr("term ends", "el período termina el")} {date(r.end_date)}</span>}</p>
          )) : <p>{tr("Not currently in a state office listed here.", "Actualmente no ocupa un cargo estatal de los que aparecen aquí.")}</p>}
          {upcoming.map((r) => (
            <p key={`u${r.type}${r.district}`}>{tr("Takes office", "Asume el cargo el")} {date(r.start_date)}: {stateOfficeLabel(r, p.state)}</p>
          ))}
          {past.length > 0 && (
            <>
              <h3 className="small">{tr("Earlier offices", "Cargos anteriores")}</h3>
              <ul className="plain">
                {past.map((r) => <li key={`p${r.type}${r.district}${r.start_date}`}>{stateOfficeLabel(r, p.state)} <span className="fine">{r.start_date ? date(r.start_date) : "?"} – {date(r.end_date)}</span></li>)}
              </ul>
            </>
          )}
          <p className="notice">
            {tr("Votes, bills and campaign money for state officials aren't on Civic Atlas yet. Each state's legislature publishes them on its own site, linked here.",
              "Los votos, proyectos y fondos de campaña de los funcionarios estatales aún no están en Civic Atlas. La legislatura de cada estado los publica en su propio sitio, enlazado aquí.")}
          </p>
        </div>
        <aside className="split-aside">
          <h2>{tr("Contact", "Contacto")}</h2>
          {p.email && <p><a href={`mailto:${p.email}`}>{p.email}</a></p>}
          {p.offices.map((o, i) => (
            <p key={i} className="fine">
              <strong>{o.classification === "capitol" ? tr("Capitol office", "Oficina en el Capitolio") : o.classification === "district" ? tr("District office", "Oficina del distrito") : tr("Office", "Oficina")}</strong><br />
              {o.address}{o.voice && <><br />{o.voice}</>}
            </p>
          ))}
          {p.links.length > 0 && (
            <>
              <h3 className="small">{tr("Official websites", "Sitios web oficiales")}</h3>
              <ul className="plain">{p.links.map((u) => <li key={u}><a href={u} rel="noopener">{host(u)}</a></li>)}</ul>
            </>
          )}
        </aside>
      </div>
      <NotesList />
    </main>
  );
}
