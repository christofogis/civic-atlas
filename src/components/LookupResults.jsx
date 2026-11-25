import LocalOfficials from "./LocalOfficials.jsx";
import StateOfficialCard, { ExtraStatewideCards } from "./StateOfficialCard.jsx";
import OfficialCard from "./OfficialCard.jsx";
import ShareResults from "./ShareResults.jsx";
import { stateName } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";
import { NotesList, NotesProvider, Ref } from "./Notes.jsx";

// Everyone elected to represent a place, grouped by level of government. Used after an address
// or location lookup on the home page, and on /officials for a saved or shared link.
export default function LookupResults({ result, sectionRef, shared = false }) {
  const { t } = useLang();
  const notes = [
    { id: "federal", text: <>{t("Districts: ", "Distritos: ")}{result.sources.district}. {t("Members of Congress and their terms: ", "Miembros del Congreso y sus períodos: ")}<a href="https://github.com/unitedstates/congress-legislators" rel="noopener">unitedstates/congress-legislators</a>{t(", updated daily. Your address is used only to find the districts; it isn't stored.", ", actualizado a diario. Su dirección se usa solo para encontrar los distritos; no se guarda.")}</> },
    result.state_officials?.length > 0 && { id: "state", text: <>{t("State legislators and the governor, lieutenant governor, attorney general and secretary of state: ", "Legisladores estatales y gobernador, vicegobernador, fiscal general y secretario de estado: ")}<a href="https://github.com/openstates/people" rel="noopener">Open States</a>{t(", updated daily.", ", actualizado a diario.")}{result.state === "CA"
      ? t(" California's treasurer, controller, insurance commissioner and superintendent of public instruction come from each office's own website, checked weekly. Board of Equalization districts aren't on Civic Atlas yet.", " El tesorero, el contralor, el comisionado de seguros y el superintendente de instrucción pública de California vienen del sitio web de cada oficina, verificado cada semana. Los distritos de la Junta de Igualación aún no están en Civic Atlas.")
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
        <ul className="level-jump" aria-label={t("Jump to", "Ir a")}>
          <li><a href="#level-federal">{t("Federal", "Federal")}</a></li>
          {result.state_officials?.length > 0 && <li><a href="#level-state">{t("State", "Estatal")}</a></li>}
          {result.local?.covered && <li><a href="#level-local">{t("County and city", "Condado y ciudad")}</a></li>}
        </ul>

        <section className="level" id="level-federal">
          <h2>{t("Federal: U.S. Congress", "Federal: Congreso de EE. UU.")}<Ref id="federal" /></h2>
          <p className="level-what">{t("Writes national laws, sets the federal budget and taxes, and oversees federal agencies. Every state has two senators; each House member represents one district.",
            "Redacta las leyes nacionales, fija el presupuesto y los impuestos federales y supervisa a las agencias federales. Cada estado tiene dos senadores; cada miembro de la Cámara representa un distrito.")}</p>
          <ul className="cards">
            {result.officials.map((o) => <OfficialCard key={`${o.chamber}-${o.bioguide_id}`} official={o} />)}
          </ul>
        </section>

        {result.state_officials?.length > 0 && (
          <section className="level" id="level-state">
            <h2>{t(`State: ${stateName(result.state)}`, `Estatal: ${stateName(result.state)}`)}<Ref id="state" /></h2>
            <p className="level-what">{t("The state legislature writes state laws and the state budget (schools, roads, health care, criminal law). The governor and other statewide officials run state government.",
              "La legislatura estatal redacta las leyes y el presupuesto del estado (escuelas, carreteras, salud, derecho penal). El gobernador y otros funcionarios estatales dirigen el gobierno del estado.")}</p>
            <ul className="cards">
              {result.state_officials.map((o) => <StateOfficialCard key={`${o.type}-${o.id}`} official={o} state={result.state} />)}
              <ExtraStatewideCards state={result.state} />
            </ul>
          </section>
        )}

        <section className="level" id="level-local">
          <LocalOfficials local={result.local} approximate={result.approximate} />
        </section>
        {!shared && <ShareResults result={result} />}
        <NotesList />      </section>
    </NotesProvider>
  );
}
