import { Fragment, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/db.js";
import TextVersions from "../components/TextVersions.jsx";
import MeetingList from "../components/MeetingList.jsx";
import DownloadCsv from "../components/DownloadCsv.jsx";
import { date, billLabel, ordinal, partyTag, partyName } from "../lib/format.js";
import { tr } from "../lib/lang.js";
import VoteBreakdown from "../components/VoteBreakdown.jsx";
import StatusBar from "../components/StatusBar.jsx";
import Follow from "../components/Follow.jsx";
import { Explain } from "../components/Explain.jsx";

const TYPES = new Set(["hr", "s", "hres", "sres", "hjres", "sjres", "hconres", "sconres"]);
const LOBBY_PREVIEW = 40;
const quarter = (k) => (k ? `Q${k % 10} ${Math.floor(k / 10)}` : "");
const filingUrl = (uuid) => `https://lda.gov/filings/public/filing/${uuid}/print/`;

async function loadBill(congress, type, number) {
  const one = (q) => q.then(({ data, error }) => { if (error) throw error; return data; });
  const key = (q) => q.eq("congress", congress).eq("bill_type", type).eq("number", number);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const [bill, sponsor, cosponsors, votes, lobbying, lobbyCount, freshness, scheduled, meetings] = await Promise.all([
    one(key(db.from("bills").select("*")).maybeSingle()),
    one(key(db.from("bill_sponsor_details").select("*")).maybeSingle()),
    one(key(db.from("bill_cosponsor_details").select("*")).order("sponsored_date").order("last_name")),
    one(db.from("votes").select("vote_id,chamber,voted_at,question,result,yea_total,nay_total,present_total,not_voting_total,source_url")
      .eq("bill_congress", congress).eq("bill_type", type).eq("bill_number", number).order("voted_at", { ascending: false })),
    // Lobbying is the heaviest query; if it fails, the rest of the page still shows.
    one(key(db.from("bill_lobbying").select("*")).order("quarters", { ascending: false }).order("client_name").limit(1000)).catch(() => null),
    one(key(db.from("bill_lobbying_counts").select("clients")).maybeSingle()).catch(() => null),
    one(db.from("data_freshness").select("*")),
    one(db.from("upcoming_events").select("event_id,chamber,kind,event_date,event_time,week_of,category,committee_id,committee_name,title,source_url")
      .contains("bill_refs", [`${congress}-${type}-${number}`]).gte("event_date", weekAgo).order("event_date")),
    one(db.from("committee_meetings").select("event_id,meeting_at,title,meeting_type,status,committee_ids")
      .contains("bill_refs", [`${congress}-${type}-${number}`]).order("meeting_at", { ascending: false }).limit(50)).catch(() => []),
  ]);
  return { bill, sponsor, cosponsors, votes, lobbying, lobbyTotal: lobbyCount?.clients ?? lobbying?.length ?? 0, freshness, scheduled, meetings };
}

function Section({ title, source, children }) {
  return (
    <section className="section">
      <h2>{title}</h2>
      {children}
      {source && <p className="fine">{tr("Source", "Fuente")}: {source}</p>}
    </section>
  );
}

export default function Bill() {
  const { congress: c, type: t, number: n } = useParams();
  const congress = Number(c), type = String(t ?? "").toLowerCase(), number = Number(n);
  const valid = Number.isInteger(congress) && TYPES.has(type) && Number.isInteger(number) && number > 0;
  const [state, setState] = useState({ status: "loading" });
  const [allLobbying, setAllLobbying] = useState(false);
  const [openVote, setOpenVote] = useState(null);

  useEffect(() => {
    if (!valid) { setState({ status: "missing" }); return; }
    setState({ status: "loading" });
    setAllLobbying(false);
    loadBill(congress, type, number)
      .then((data) => setState(data.bill ? { status: "done", data } : { status: "missing" }))
      .catch(() => setState({ status: "error" }));
  }, [congress, type, number, valid]);

  if (state.status === "loading") return <main className="page"><p>{tr("Loading…", "Cargando…")}</p></main>;
  if (state.status === "missing") return <main className="page"><h1>{tr("Bill not found", "Proyecto no encontrado")}</h1><p>{tr("Bills from the 118th Congress (2023) on are covered.", "Se incluyen los proyectos desde el 118.º Congreso (2023).")} <Link to="/">{tr("Back to search", "Volver a la búsqueda")}</Link></p></main>;
  if (state.status === "error") return <main className="page"><p className="notice">{tr("Couldn't load this page right now. Try again shortly.", "No se pudo cargar esta página. Inténtelo de nuevo en un momento.")}</p></main>;

  const { bill: b, sponsor, cosponsors, votes, lobbying, lobbyTotal, freshness, scheduled, meetings } = state.data;
  const fresh = Object.fromEntries(freshness.map((f) => [f.job, f.last_success_at]));
  const updated = (job) => (fresh[job] ? tr(` Updated ${date(fresh[job])}.`, ` Actualizado el ${date(fresh[job])}.`) : "");
  const current = cosponsors.filter((x) => !x.withdrawn_date);
  const withdrawn = cosponsors.filter((x) => x.withdrawn_date);
  const byParty = Object.entries(current.reduce((acc, x) => ({ ...acc, [x.party ?? "Unknown"]: (acc[x.party ?? "Unknown"] ?? 0) + 1 }), {}))
    .sort((a, z) => a[0].localeCompare(z[0]));
  const shownLobbying = !lobbying ? [] : allLobbying ? lobbying : lobbying.slice(0, LOBBY_PREVIEW);
  const person = (p) => (
    <><Link to={`/member/${p.bioguide_id}`}>{p.name}</Link>{p.party && <> ({partyTag(p)})</>}</>
  );

  return (
    <main className="page">
      <header>
        <p className="fine">{billLabel(b)} · {ordinal(b.congress)} {tr("Congress", "Congreso")} · <Explain id="bill-types">{tr(`What's an ${billLabel(b).replace(/\s*\d+$/, "")}?`, `¿Qué es un ${billLabel(b).replace(/\s*\d+$/, "")}?`)}</Explain></p>
        <h1 className="bill-title">{b.short_title ?? b.title}</h1>
        {b.short_title && b.short_title !== b.title && <p className="lede">{b.title}</p>}
        {sponsor && <p>{tr("Sponsor", "Patrocinador")}: {person(sponsor)}</p>}
        <p className="fine">
          {tr("Introduced", "Presentado el")} {date(b.introduced_date)}{b.policy_area && <> · {tr("Policy area", "Área de política")}: {b.policy_area}</>}
        </p>
        {b.latest_action_text && <p>{tr("Latest action", "Última acción")} ({date(b.latest_action_date)}): {b.latest_action_text}</p>}
        <p className="fine"><a href={b.source_url}>{tr("Full text, actions and history at Congress.gov", "Texto completo, acciones e historial en Congress.gov (en inglés)")}</a></p>
        <Follow feed={`/api/feed/bill/${b.congress}/${b.bill_type}/${b.number}`} />
      </header>

      <StatusBar bill={b} />
      {scheduled.length > 0 && (
        <div className="notice-box">
          <strong>{tr("Scheduled", "Programado")}</strong>
          <ul className="plain">
            {scheduled.map((e) => (
              <li key={e.event_id}>
                {e.kind === "floor"
                  ? <>{tr("On the House floor schedule for the week of", "En la agenda del pleno de la Cámara para la semana del")} {date(e.event_date)}{e.category === "suspension" ? tr(" as a fast-track vote (needs two-thirds)", " como votación por vía rápida (requiere dos tercios)") : e.category === "rule" ? tr(" under a rule", " bajo una regla") : ""}.</>
                  : <>{e.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")} {e.committee_id ? <Link to={`/committee/${e.committee_id}`}>{e.committee_name}</Link> : e.committee_name} {tr(e.kind, { hearing: "audiencia", markup: "sesión de enmiendas", meeting: "reunión" }[e.kind])}, {date(e.event_date)}{e.event_time ? tr(` at ${e.event_time} ET`, ` a las ${e.event_time} (hora del Este)`) : ""}.</>}
                {" "}<a href={e.source_url} className="fine">{tr("Schedule", "Agenda")}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title={tr("Summary", "Resumen")} source={<>{tr("Congressional Research Service, via GovInfo Bill Status.", "Servicio de Investigación del Congreso, vía GovInfo Bill Status. Los resúmenes se publican solo en inglés.")} <Explain id="crs-summary">{tr("About these summaries", "Sobre estos resúmenes")}</Explain></>}>
        {b.crs_summary
          ? <p>{b.crs_summary}</p>
          : <p>{tr("The Congressional Research Service hasn't published a summary of this bill yet. The bill text is at Congress.gov.", "El Servicio de Investigación del Congreso todavía no ha publicado un resumen de este proyecto. El texto está en Congress.gov.")}</p>}
      </Section>

      <TextVersions congress={congress} type={type} number={number} />

      <Section title={tr("Cosponsors", "Copatrocinadores")} source={tr(`GovInfo Bill Status (Library of Congress).${updated("bills")} Party and seat as of the day each member signed on.`, `GovInfo Bill Status (Biblioteca del Congreso).${updated("bills")} Partido y escaño a la fecha en que cada miembro se sumó.`)}>
        {current.length === 0 ? <p>{tr("No cosponsors.", "Sin copatrocinadores.")}</p> : (
          <>
            <p>{tr(`${current.length} cosponsor${current.length === 1 ? "" : "s"}`, `${current.length} copatrocinador${current.length === 1 ? "" : "es"}`)}: {byParty.map(([p, k]) => `${k} ${partyName(p)}`).join(", ")}.</p>
            <ul className="plain columns">
              {current.map((x) => (
                <li key={x.bioguide_id}>{person(x)} <span className="fine">· {date(x.sponsored_date)}{x.is_original ? tr(" · original", " · original") : ""}</span></li>
              ))}
            </ul>
          </>
        )}
        {withdrawn.length > 0 && (
          <p className="fine">{tr("Withdrawn", "Retirados")}: {withdrawn.map((x, i) => <span key={x.bioguide_id}>{i ? "; " : ""}{x.name} ({date(x.withdrawn_date)})</span>)}</p>
        )}
      </Section>

      {meetings.length > 0 && (
        <Section title={tr("Committee hearings and markups", "Audiencias y sesiones de comités")} source={tr("Congress.gov committee meeting records, where the meeting lists this bill.", "Registros de reuniones de comités de Congress.gov que mencionan este proyecto.")}>
          <MeetingList meetings={meetings} />
        </Section>
      )}

      <Section title={tr("Roll-call votes", "Votaciones nominales")} source={<>{tr("House Clerk and Senate.gov roll-call records.", "Registros de votaciones del Secretario de la Cámara y de Senate.gov.")} <Link to="/methods#vote-types">{tr("About vote types", "Sobre los tipos de votación")}</Link>.</>}>
        {votes.length === 0 ? <p>{tr("No recorded roll-call votes on this bill. Many bills pass by voice vote or never reach the floor.", "No hay votaciones nominales registradas sobre este proyecto. Muchos proyectos se aprueban a viva voz o nunca llegan al pleno.")}</p> : (
          <table>
            <thead><tr><th>{tr("Date", "Fecha")}</th><th>{tr("Chamber", "Cámara")}</th><th>{tr("Question", "Asunto")}</th><th>{tr("Result", "Resultado")}</th><th>{tr("Yea–Nay", "Sí–No")}</th></tr></thead>
            <tbody>
              {votes.map((v) => (
                <Fragment key={v.vote_id}>
                  <tr>
                    <td>{date(v.voted_at)}</td>
                    <td>{v.chamber === "house" ? tr("House", "Cámara") : tr("Senate", "Senado")}</td>
                    <td>
                      <a href={v.source_url}>{v.question}</a>
                      <div><button className="link fine" aria-expanded={openVote === v.vote_id}
                        onClick={() => setOpenVote(openVote === v.vote_id ? null : v.vote_id)}>
                        {openVote === v.vote_id ? tr("Hide how members voted", "Ocultar cómo votaron") : tr("How members voted", "Cómo votaron los miembros")}
                      </button></div>
                    </td>
                    <td>{v.result}</td>
                    <td>{v.yea_total}–{v.nay_total}</td>
                  </tr>
                  {openVote === v.vote_id && <tr><td colSpan={5}><VoteBreakdown voteId={v.vote_id} /></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={tr("Lobbying reports naming this bill", "Informes de cabildeo que mencionan este proyecto")}
        source={<>{tr("Quarterly lobbying reports (LD-2) filed under the Lobbying Disclosure Act, retrieved from LDA.gov.", "Informes trimestrales de cabildeo (LD-2) presentados según la Ley de Divulgación de Cabildeo, obtenidos de LDA.gov.")}{updated("lobbying")} {tr("The Senate Office of Public Records can't vouch for data or analyses derived from these reports after they're retrieved.", "La Oficina de Registros Públicos del Senado no puede garantizar los datos ni los análisis derivados de estos informes después de obtenerlos.")} <Link to="/methods#lobbying">{tr("About this data", "Sobre estos datos")}</Link>.</>}>
        {lobbying == null ? <p className="notice">{tr("Lobbying reports didn't load. Reload the page to try again.", "Los informes de cabildeo no se cargaron. Vuelva a cargar la página para intentarlo de nuevo.")}</p>
          : lobbying.length === 0 ? <p>{tr("No lobbying reports on file name this bill.", "Ningún informe de cabildeo registrado menciona este proyecto.")}</p> : (
          <>
            <p>
              {tr(`${lobbyTotal.toLocaleString()} organization${lobbyTotal === 1 ? "" : "s"} reported lobbying on this bill. A report lists the bill; it doesn't say whether the organization supported or opposed it.`,
                `${lobbyTotal.toLocaleString()} organizaci${lobbyTotal === 1 ? "ón informó" : "ones informaron"} cabildeo sobre este proyecto. Un informe menciona el proyecto; no dice si la organización lo apoyaba o se oponía.`)}
            </p>
            <table>
              <thead><tr><th>{tr("Client", "Cliente")}</th><th>{tr("Lobbying done by", "Cabildeo realizado por")}</th><th>{tr("Quarters", "Trimestres")}</th><th>{tr("Report", "Informe")}</th></tr></thead>
              <tbody>
                {shownLobbying.map((l) => {
                  const firms = l.registrants.filter((r) => r !== l.client_name);
                  return (
                    <tr key={l.client_id}>
                      <td>{l.client_name}</td>
                      <td>{firms.length ? firms.join("; ") : <span className="fine">{tr("In-house", "Interno")}</span>}</td>
                      <td>{l.quarters === 1 ? quarter(l.first_quarter_key) : `${l.quarters} (${quarter(l.first_quarter_key)}–${quarter(l.last_quarter_key)})`}</td>
                      <td><a href={filingUrl(l.latest_filing_uuid)}>{tr("Latest", "Último")}</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <DownloadCsv rows={lobbying} filename={`lobbying-${congress}-${type}${number}`} columns={[
              ["Client", (l) => l.client_name], ["Lobbying done by", (l) => l.registrants.join("; ")], ["Quarters", (l) => l.quarters],
              ["First quarter", (l) => quarter(l.first_quarter_key)], ["Last quarter", (l) => quarter(l.last_quarter_key)],
              ["Latest report", (l) => filingUrl(l.latest_filing_uuid)],
            ]} />
            {lobbying.length > LOBBY_PREVIEW && !allLobbying && (
              <p><button className="link" onClick={() => setAllLobbying(true)}>
                {lobbying.length < lobbyTotal ? tr(`Show ${lobbying.length.toLocaleString()} with the most quarters`, `Mostrar ${lobbying.length.toLocaleString()} con más trimestres`) : tr(`Show all ${lobbying.length.toLocaleString()}`, `Mostrar los ${lobbying.length.toLocaleString()}`)}
              </button></p>
            )}
            {allLobbying && lobbying.length < lobbyTotal && (
              <p className="fine">{tr(`Showing ${lobbying.length.toLocaleString()} of ${lobbyTotal.toLocaleString()}. Search every report at`, `Se muestran ${lobbying.length.toLocaleString()} de ${lobbyTotal.toLocaleString()}. Busque todos los informes en`)} <a href="https://lda.gov/filings/public/filing/search/">LDA.gov</a>.</p>
            )}
          </>
        )}
      </Section>
    </main>
  );
}
