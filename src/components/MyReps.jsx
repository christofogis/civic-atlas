import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/db.js";
import { partyTag, date } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";
import { forgetRepresentatives } from "../lib/myReps.js";
import { KindLabel } from "./Explain.jsx";
import { PartyTag } from "./PartyTag.jsx";

// The home page for a returning visitor: their representatives, the latest vote each cast,
// and how many hearings their committees have coming up.
export default function MyReps({ ids, onForget }) {
  const [rows, setRows] = useState(null);
  const { t } = useLang();

  useEffect(() => {
    const list = [...ids];
    const today = new Date().toISOString().slice(0, 10);
    Promise.all([
      db.from("member_directory").select("bioguide_id,name,chamber,state,district,party,serving").in("bioguide_id", list),
      ...list.map((id) => db.from("member_votes").select("bioguide_id,chamber,position,question,description,document_name,voted_at,bill_congress,bill_type,bill_number,bill_title")
        .eq("bioguide_id", id).order("voted_at", { ascending: false }).limit(1)),
      db.from("committee_memberships").select("bioguide_id,committee_id,congress").in("bioguide_id", list),
    ]).then(async (res) => {
      const people = res[0].data ?? [];
      const latest = Object.fromEntries(res.slice(1, 1 + list.length).map((r) => [r.data?.[0]?.bioguide_id, r.data?.[0]]));
      const cm = res[1 + list.length].data ?? [];
      const top = Math.max(0, ...cm.map((c) => c.congress));
      const committees = [...new Set(cm.filter((c) => c.congress === top).map((c) => c.committee_id))];
      const { count } = committees.length
        ? await db.from("upcoming_events").select("*", { count: "exact", head: true }).in("committee_id", committees).gte("event_date", today)
        : { count: 0 };
      const order = { senate: 0, house: 1 };
      setRows({ people: people.sort((a, z) => order[a.chamber] - order[z.chamber]), latest, hearings: count ?? 0 });
    }).catch(() => setRows({ people: [], latest: {}, hearings: 0 }));
  }, [ids]);

  if (!rows) return <p>{t("Loading your representatives…", "Cargando sus representantes…")}</p>;
  if (rows.people.length === 0) return null;
  return (
    <section className="my-reps">
      <h2>{t("Your representatives", "Sus representantes")}</h2>
      <ul className="bare">
        {rows.people.map((p) => {
          const v = rows.latest[p.bioguide_id];
          return (
            <li key={p.bioguide_id}>
              <Link to={`/member/${p.bioguide_id}`} className="my-rep-name">{p.name}</Link> <PartyTag p={p} /> <span className="fine">{p.chamber === "senate" ? t("Senator", "Senado") : p.district > 0 || p.district === 0 ? t("Representative", "Cámara") : ""}</span>
              {v && (
                <div className="fine">
                  {t("Latest vote", "Último voto")}, {date(v.voted_at)}: <strong>{v.position}</strong> · <KindLabel v={v} />{" "}
                  {v.bill_type
                    ? <Link to={`/bill/${v.bill_congress}/${v.bill_type}/${v.bill_number}`}>{v.bill_title ?? v.question}</Link>
                    : v.description ?? v.question}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p>
        <Link to="/week">{t("This week in Congress", "Esta semana en el Congreso")}</Link>
        {rows.hearings > 0 && <> · {t(`their committees have ${rows.hearings} hearing${rows.hearings === 1 ? "" : "s"} or markup${rows.hearings === 1 ? "" : "s"} coming up`, `sus comités tienen ${rows.hearings} audiencia${rows.hearings === 1 ? "" : "s"} o sesi${rows.hearings === 1 ? "ón" : "ones"} de enmiendas próximas`)}</>}
        {" · "}<Link to="/quiz">{t("Do you vote like them?", "¿Vota como ellos?")}</Link>
      </p>
      <p className="fine">
        {t("Remembered on this device from your last lookup (member IDs only, never your address).", "Guardado en este dispositivo desde su última búsqueda (solo los identificadores de los miembros, nunca su dirección).")}{" "}
        <button type="button" className="link fine" onClick={() => { forgetRepresentatives(); onForget(); }}>{t("Forget them", "Olvidarlos")}</button>
      </p>
    </section>
  );
}
