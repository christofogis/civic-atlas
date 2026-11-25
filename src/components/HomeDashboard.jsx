import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { date } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import { loadLocal } from "../lib/local.js";
import { savedDistricts } from "../lib/savedDistricts.js";
import { listedDates, ruleDates } from "../../lib/localMeetings.js";

// "At a glance" on the home page: what's coming up in Congress, the visitor's next local meetings
// and ballot (from the districts saved by their last lookup, never an address), and the latest
// federal budget totals. Each tile is a count or a date with a link to the full page: no rankings,
// no arrows, no judgments.
const todayLA = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const todayEastern = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(tr("en-US", "es-US"), { weekday: "short", month: "short", day: "numeric" });
const T = (n) => `$${(n / 1e12).toFixed(2)} ${tr("trillion", "billones")}`;

function Tile({ title, to, linkText, children }) {
  return (
    <section className="glance-tile">
      <h3>{title}</h3>
      {children}
      <p className="glance-link"><Link to={to}>{linkText}</Link></p>
    </section>
  );
}

function CongressTile() {
  const [s, setS] = useState(null);
  useEffect(() => {
    const today = todayEastern();
    const start = new Date(`${today}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)); // Monday of this week
    const end = new Date(`${today}T12:00:00Z`); end.setUTCDate(end.getUTCDate() + 14);
    db.from("upcoming_events").select("kind,event_date,chamber")
      .gte("event_date", start.toISOString().slice(0, 10)).lte("event_date", end.toISOString().slice(0, 10)).limit(500)
      .then(({ data, error }) => {
        if (error) { setS({ error: true }); return; }
        const rows = data ?? [];
        // House floor items are dated by the week they're scheduled for (its Monday).
        const floorWeek = rows.filter((e) => e.kind === "floor").map((e) => e.event_date).sort()[0];
        setS({
          floorWeek,
          floor: rows.filter((e) => e.kind === "floor" && e.event_date === floorWeek).length,
          meetings: rows.filter((e) => !["floor", "convene"].includes(e.kind) && e.event_date >= today).length,
          convene: rows.filter((e) => e.kind === "convene" && e.event_date >= today).sort((a, z) => a.event_date.localeCompare(z.event_date))[0],
        });
      });
  }, []);
  return (
    <Tile title={tr("Coming up in Congress", "Próximamente en el Congreso")} to="/week" linkText={tr("This week in Congress", "Esta semana en el Congreso")}>
      {!s ? <p className="fine">{tr("Loading…", "Cargando…")}</p> : s.error ? <p className="fine">{tr("Couldn't load the schedule.", "No se pudo cargar la agenda.")}</p> : (
        <ul className="glance-figures">
          {s.floorWeek
            ? <li><span className="fig">{s.floor}</span> {tr(`${s.floor === 1 ? "item" : "items"} on the House floor schedule, week of ${day(s.floorWeek)}`, `${s.floor === 1 ? "asunto" : "asuntos"} en la agenda del pleno de la Cámara, semana del ${day(s.floorWeek)}`)}</li>
            : <li>{tr("The House hasn't posted its next floor schedule yet.", "La Cámara aún no ha publicado su próxima agenda del pleno.")}</li>}
          <li><span className="fig">{s.meetings}</span> {tr(s.meetings === 1 ? "committee hearing or meeting in the next two weeks" : "committee hearings and meetings in the next two weeks", s.meetings === 1 ? "audiencia o reunión de comité en las próximas dos semanas" : "audiencias y reuniones de comité en las próximas dos semanas")}</li>
          {s.convene && <li>{tr(`The ${s.convene.chamber === "senate" ? "Senate" : "House"} next meets ${day(s.convene.event_date)}`, `${s.convene.chamber === "senate" ? "El Senado" : "La Cámara"} se reúne el ${day(s.convene.event_date)}`)}</li>}
        </ul>
      )}
    </Tile>
  );
}

function LocalTile({ params }) {
  const [data, setData] = useState(null);
  const co = params.get("co");
  useEffect(() => { loadLocal(co).then(setData).catch(() => setData(false)); }, [co]);
  if (!data) return null;
  const from = todayLA();
  const city = params.get("pt") === "c" ? data.cities?.find((c) => c.name === params.get("pl")) : null;
  const council = city?.meeting_rule ? ruleDates(city.meeting_rule, from, 1)[0] : null;
  const board = data.board_meetings ? listedDates(data.board_meetings.dates, from, 1)[0] : null;
  if (!council && !board) return null;
  return (
    <Tile title={tr("Your next local meetings", "Sus próximas reuniones locales")} to={`/local/${co}${city ? `#${city.id}` : ""}`} linkText={tr("Agendas and officials", "Agendas y funcionarios")}>
      <ul className="glance-figures">
        {council && <li><span className="fig">{day(council.date)}</span> {tr(`${city.name} City Council`, `Concejo Municipal de ${city.name}`)}</li>}
        {board && <li><span className="fig">{day(board.date)}</span> {tr(`${data.county} Board of Supervisors`, `Junta de Supervisores del ${data.county}`)}</li>}
      </ul>
      <p className="fine">{tr("Open to the public, with time for public comment.", "Abiertas al público, con tiempo para comentarios.")}</p>
    </Tile>
  );
}

function BallotTile() {
  const [m, setM] = useState(null);
  useEffect(() => { fetch("/data/measures/ca-2028.json").then((r) => r.json()).then(setM).catch(() => {}); }, []);
  if (!m) return null;
  const n = (s) => m.measures.filter((x) => x.status === s).length;
  return (
    <Tile title={tr("On your next statewide ballot", "En su próxima boleta estatal")} to="/measures" linkText={tr("California ballot measures", "Medidas en la boleta de California")}>
      <p><span className="fig">{date(m.election)}</span></p>
      <ul className="glance-figures">
        <li><span className="fig">{n("qualified")}</span> {tr("measure qualified so far", "medida calificada hasta ahora")}</li>
        <li><span className="fig">{n("eligible")}</span> {tr("more eligible, not yet certified", "más elegibles, aún no certificadas")}</li>
      </ul>
    </Tile>
  );
}

function BudgetTile() {
  const [b, setB] = useState(null);
  useEffect(() => { fetch("/data/budget.json").then((r) => r.json()).then(setB).catch(() => {}); }, []);
  if (!b) return null;
  const y = b.years.at(-1);
  const max = y.outlays_total;
  return (
    <Tile title={tr(`Federal budget, FY${y.fiscal_year}`, `Presupuesto federal, AF${y.fiscal_year}`)} to="/budget" linkText={tr("Where the money went", "En qué se gastó")}>
      <div className="glance-bars" role="img" aria-label={tr(`Spent ${T(y.outlays_total)}, took in ${T(y.receipts_total)}`, `Gastó ${T(y.outlays_total)}, recaudó ${T(y.receipts_total)}`)}>
        <div><span>{tr("Spent", "Gastó")}</span><span className="gb"><span style={{ width: "100%", background: "#f47230" }} /></span><span>{T(y.outlays_total)}</span></div>
        <div><span>{tr("Took in", "Recaudó")}</span><span className="gb"><span style={{ width: `${(100 * y.receipts_total) / max}%`, background: "#00b894" }} /></span><span>{T(y.receipts_total)}</span></div>
      </div>
      <p className="fine">{y.deficit >= 0 ? tr(`Deficit: ${T(y.deficit)}`, `Déficit: ${T(y.deficit)}`) : tr(`Surplus: ${T(-y.deficit)}`, `Superávit: ${T(-y.deficit)}`)}</p>
    </Tile>
  );
}

export default function HomeDashboard() {
  const saved = savedDistricts();
  const params = new URLSearchParams(saved ?? "");
  return (
    <section className="glance" aria-labelledby="glance-h">
      <h2 id="glance-h">{tr("At a glance", "De un vistazo")}</h2>
      <div className="glance-grid">
        {params.get("co") && <LocalTile params={params} />}
        <CongressTile />
        {params.get("st") === "CA" && <BallotTile />}
        <BudgetTile />
      </div>
    </section>
  );
}
