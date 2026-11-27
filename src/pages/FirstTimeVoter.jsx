import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { date, stateName } from "../lib/format.js";
import { useLang } from "../lib/i18n.jsx";
import { savedDistricts } from "../lib/savedDistricts.js";
import { generalElectionDate, nextElectionYear } from "../../lib/upForElection.js";
import { AMENDMENT_26, registrationLinks, savedState } from "../../lib/firstVoter.js";
import OfficialCard from "../components/OfficialCard.jsx";

// "First time voting?": three steps for someone about to vote for the first time. Short text first,
// one button per step; every rule that varies by state (deadlines, ID, pre-registration ages) is left
// to the official sources linked here, never stated by this site. The same page for everyone; a saved
// lookup (district numbers only) adds the visitor's state links and officials.
const CA_LABELS = {
  "ca-register": ["Register online in California (Secretary of State)", "Inscribirse en línea en California (Secretaría de Estado)"],
  "ca-status": ["Check your registration status", "Consultar su estado de inscripción"],
  "ca-preregister": ["Pre-registration in California", "Preinscripción en California"],
};

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function FirstTimeVoter() {
  const { t, lang } = useLang();
  const saved = savedDistricts();
  const state = savedState(saved);
  const [main, ...stateLinks] = registrationLinks(state, lang);
  const year = nextElectionYear(today());
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!saved) return;
    fetch(`/api/officials?${saved}`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setResult).catch(() => setResult(false));
  }, [saved]);

  return (
    <main className="page first-voter">
      <h1>{t("First time voting?", "¿Va a votar por primera vez?")}</h1>
      <p className="lede">{t("Three steps. Each one links to the official source.", "Tres pasos. Cada uno enlaza a la fuente oficial.")}</p>

      <ol className="voter-steps">
        <li>
          <h2>{t("Register", "Inscríbase")}</h2>
          <p>
            {t("U.S. citizens who are 18 by Election Day can vote in federal elections ", "Los ciudadanos de EE. UU. que tengan 18 años el día de la elección pueden votar en las elecciones federales ")}
            (<a href={AMENDMENT_26}>{t("26th Amendment", "Enmienda 26")}</a>).
            {t(" Some states let 16- and 17-year-olds pre-register. Deadlines and other rules are set by each state; vote.gov has yours.",
              " Algunos estados permiten preinscribirse a los 16 y 17 años. Las fechas límite y otras reglas las fija cada estado; vote.gov tiene las suyas.")}
          </p>
          <p><a className="button-primary" href={main.url}>{t("Register at vote.gov", "Inscribirse en vote.gov")}</a></p>
          <p className="fine">{t("vote.gov is the U.S. government's official registration site. It leads to every state's election office.", "vote.gov es el sitio oficial de inscripción del gobierno de EE. UU. Lleva a la oficina electoral de cada estado.")}</p>
          {stateLinks.length > 0 && (
            <ul className="plain fine">
              {stateLinks.map((l) => <li key={l.id}><a href={l.url}>{t(...CA_LABELS[l.id])}</a></li>)}
            </ul>
          )}
        </li>

        <li>
          <h2>{t("Know your ballot", "Conozca su boleta")}</h2>
          <p>{t(`The next general election is ${date(generalElectionDate(year))}. See which seats are on the ballot and who holds them now.`,
            `La próxima elección general es el ${date(generalElectionDate(year))}. Vea qué escaños están en la boleta y quién los ocupa ahora.`)}</p>
          <p><Link className="button-primary" to={`/on-the-ballot?year=${year}`}>{t(`On the ballot in ${year}`, `En la boleta en ${year}`)}</Link></p>
          {state === "CA" && year === 2028 && (
            <p className="fine"><Link to="/measures">{t("California's 2028 ballot measures: March 7 primary and November 7 general election", "Medidas en la boleta de California en 2028: primaria del 7 de marzo y elección general del 7 de noviembre")}</Link></p>
          )}
        </li>

        <li>
          <h2>{t("Know who represents you", "Sepa quién le representa")}</h2>
          {saved ? (
            <>
              <p>{t(`Your members of Congress${state ? ` for ${stateName(state)}` : ""}, from your last lookup on this device.`,
                `Sus miembros del Congreso${state ? ` por ${stateName(state)}` : ""}, de su última búsqueda en este dispositivo.`)}</p>
              {result === null && <p className="fine">{t("Loading…", "Cargando…")}</p>}
              {result === false && <p className="notice">{t("Your officials didn't load. Reload the page to try again.", "Sus funcionarios no se cargaron. Vuelva a cargar la página.")}</p>}
              {result && result.officials.length > 0 && (
                <ul className="cards">
                  {result.officials.map((o) => <OfficialCard key={`${o.chamber}-${o.bioguide_id}`} official={o} />)}
                </ul>
              )}
              <p><Link className="button-primary" to={`/officials?${saved}`}>{t("All your officials", "Todos sus funcionarios")}</Link></p>
            </>
          ) : (
            <>
              <p>{t("Enter your address to see everyone elected to represent it, from Congress to your state.", "Escriba su dirección para ver a todos los elegidos para representarla, del Congreso a su estado.")}</p>
              <p><Link className="button-primary" to="/">{t("Look up your address", "Buscar su dirección")}</Link></p>
            </>
          )}
        </li>
      </ol>

      <h2>{t("Learn more", "Aprenda más")}</h2>
      <ul className="plain">
        <li><Link to="/quiz">{t("See how your views line up with your members' votes", "Vea cómo se comparan sus opiniones con los votos de sus miembros")}</Link></li>
        <li><Link to="/government">{t("Who makes the laws: the three branches", "Quién hace las leyes: los tres poderes")}</Link></li>
        <li><Link to="/glossary">{t("Glossary of terms", "Glosario de términos")}</Link></li>
      </ul>
      <p className="fine"><Link to="/methods#first-time-voter">{t("What this page links to, and why", "A qué enlaza esta página y por qué")}</Link></p>
    </main>
  );
}
