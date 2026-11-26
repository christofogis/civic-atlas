import LocalOfficials from "./LocalOfficials.jsx";
import StateOfficialCard, { ExtraStatewideCards } from "./StateOfficialCard.jsx";

const LEGISLATIVE = new Set(["upper", "lower", "legislature"]);
import OfficialCard from "./OfficialCard.jsx";
import ShareResults from "./ShareResults.jsx";
import { stateName } from "../lib/format.js";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { useLang } from "../lib/i18n.jsx";
import { Fold } from "./Fold.jsx";
import { NotesList, NotesProvider, Ref } from "./Notes.jsx";

// Everyone elected to represent a place, grouped by level of government. Used after an address
// or location lookup on the home page, and on /officials for a saved or shared link.
export default function LookupResults({ result, sectionRef, shared = false }) {
  const { t } = useLang();
  // Each level opens in place; its label lists who's in it. Federal starts open. Printing opens
  // every level first, so the printed list is complete.
  // A saved or shared list (/officials) is for seeing everyone at once, so it starts fully open.
  const [open, setOpen] = useState(() => new Set(shared ? ["level-federal", "level-state", "level-local"] : ["level-federal"]));
  const toggle = (id, isOpen) => setOpen((prev) => {
    if (prev.has(id) === isOpen) return prev;
    const next = new Set(prev); if (isOpen) next.add(id); else next.delete(id); return next;
  });
  // Printing from the browser's own menu opens every level too.
  useEffect(() => {
    const all = () => flushSync(() => setOpen(new Set(["level-federal", "level-state", "level-local"])));
    window.addEventListener("beforeprint", all);
    return () => window.removeEventListener("beforeprint", all);
  }, []);
  const printList = () => {
    setOpen(new Set(["level-federal", "level-state", "level-local"]));
    setTimeout(() => window.print(), 150);
  };
  const names = (list, extra = 0) => {
    const n = list.filter(Boolean);
    const more = n.length - 3 + extra;
    return n.length <= 3 && !extra ? n.join(", ") : t(`${n.slice(0, 3).join(", ")} and ${more} more`, `${n.slice(0, 3).join(", ")} y ${more} más`);
  };
  const fedNames = names(result.officials.filter((o) => o.seat_status !== "pending_update").map((o) => o.name));
  // California's four extra statewide offices and its Board of Equalization member load separately
  // (ExtraStatewideCards); count them.
  const stateNames = names((result.state_officials ?? []).filter((o) => !o.updating).map((o) => o.name), result.state === "CA" ? 4 + (result.state_districts?.boe?.length ?? 0) : 0);
  const notes = [
    { id: "federal", text: <>{t("Districts: ", "Distritos: ")}{result.sources.district}. {t("Members of Congress and their terms: ", "Miembros del Congreso y sus períodos: ")}<a href="https://github.com/unitedstates/congress-legislators" rel="noopener">unitedstates/congress-legislators</a>{t(", updated daily. Your address is used only to find the districts; it isn't stored.", ", actualizado a diario. Su dirección se usa solo para encontrar los distritos; no se guarda.")}</> },
    result.state_officials?.length > 0 && { id: "state", text: <>{t("State legislators and the governor, lieutenant governor, attorney general and secretary of state: ", "Legisladores estatales y gobernador, vicegobernador, fiscal general y secretario de estado: ")}<a href="https://github.com/openstates/people" rel="noopener">Open States</a>{t(", updated daily.", ", actualizado a diario.")}{result.state === "CA"
      ? t(" California's treasurer, controller, insurance commissioner and superintendent of public instruction come from each office's own website, checked weekly. The Board of Equalization member comes from the board's website; the district, from the Citizens Redistricting Commission's 2021 map.", " El tesorero, el contralor, el comisionado de seguros y el superintendente de instrucción pública de California vienen del sitio web de cada oficina, verificado cada semana. El miembro de la Junta de Igualación viene del sitio web de la junta; el distrito, del mapa de 2021 de la Comisión Ciudadana de Redistritación.")
      : t(" Other statewide offices, such as treasurer, are on Civic Atlas for California only so far.", " Otros cargos estatales, como tesorero, por ahora solo están en Civic Atlas para California.")}</> },
  ];
  return (
    <NotesProvider notes={notes}>
    <section className="results" ref={sectionRef} aria-live="polite">
        <h2 className="results-title">
          {shared ? t("Districts", "Distritos") : t("Your officials", "Sus funcionarios")}
          <span className="fine"> · {stateName(result.state)}
          {result.districts.length === 1 && result.officials.some((o) => o.chamber === "house" && o.district !== 0)
            ? t(`, congressional district ${result.districts[0]}`, `, distrito del Congreso ${result.districts[0]}`) : ""}</span>
        </h2>
        {result.stale_districts && (
          <p className="notice">
            {t(`This link was saved under the ${result.stale_districts}th Congress. House districts can change with each new Congress, so the House member isn't shown. Look up the address again to see it.`,
              `Este enlace se guardó durante el ${result.stale_districts}.º Congreso. Los distritos de la Cámara pueden cambiar con cada nuevo Congreso, así que no se muestra al miembro de la Cámara. Busque la dirección de nuevo para verlo.`)}
          </p>
        )}
        {result.approximate && (
          <p className="notice">
            {t("This location may fall in more than one district. A full street address gives an exact match.", "Este lugar puede estar en más de un distrito. Una dirección completa da un resultado exacto.")}
          </p>
        )}

        <div className="folds levels">
        <Fold id="level-federal" title={t("Federal: U.S. Congress", "Federal: Congreso de EE. UU.")} summary={fedNames} open={open.has("level-federal")} onToggle={toggle}>
          <p className="level-what">{t("Writes national laws, sets the federal budget and taxes, and oversees federal agencies. Every state has two senators; each House member represents one district.",
            "Redacta las leyes nacionales, fija el presupuesto y los impuestos federales y supervisa a las agencias federales. Cada estado tiene dos senadores; cada miembro de la Cámara representa un distrito.")}<Ref id="federal" /></p>
          <ul className="cards">
            {result.officials.map((o) => <OfficialCard key={`${o.chamber}-${o.bioguide_id}`} official={o} />)}
          </ul>
        </Fold>

        {result.state_officials?.length > 0 && (
          <Fold id="level-state" title={t(`State: ${stateName(result.state)}`, `Estatal: ${stateName(result.state)}`)} summary={stateNames} open={open.has("level-state")} onToggle={toggle}>
            <p className="level-what">{t("The state legislature writes state laws and the state budget (schools, roads, health care, criminal law). The governor and other statewide officials run state government.",
              "La legislatura estatal redacta las leyes y el presupuesto del estado (escuelas, carreteras, salud, derecho penal). El gobernador y otros funcionarios estatales dirigen el gobierno del estado.")}<Ref id="state" /></p>
            {/* Your own legislators as cards; the other state officials (statewide offices, Board of Equalization) as a compact list. */}
            <ul className="cards">
              {result.state_officials.filter((o) => LEGISLATIVE.has(o.type)).map((o) => <StateOfficialCard key={`${o.type}-${o.id}`} official={o} state={result.state} />)}
            </ul>
            <h3 className="compact-head">{t("Other state officials", "Otros funcionarios estatales")}</h3>
            <ul className="cards compact">
              {result.state_officials.filter((o) => !LEGISLATIVE.has(o.type)).map((o) => <StateOfficialCard key={`${o.type}-${o.id}`} official={o} state={result.state} />)}
              <ExtraStatewideCards state={result.state} boe={result.state_districts?.boe ?? []} />
            </ul>
          </Fold>
        )}

        <Fold id="level-local" title={t("County and city", "Condado y ciudad")} open={open.has("level-local")} onToggle={toggle}
          summary={result.local?.covered
            ? [result.local.place?.name, result.local.county].filter(Boolean).join(", ") || t("Your county and city officials", "Sus funcionarios del condado y la ciudad")
            : t("On Civic Atlas for Orange County, CA only, so far", "Por ahora, solo para el Condado de Orange, CA")}>
          <LocalOfficials local={result.local} approximate={result.approximate} />
        </Fold>
        </div>
        <p className="no-print"><button type="button" className="button-secondary" onClick={printList}>{t("Print this list", "Imprimir esta lista")}</button></p>
        {!shared && <ShareResults result={result} />}
        <NotesList />      </section>
    </NotesProvider>
  );
}
