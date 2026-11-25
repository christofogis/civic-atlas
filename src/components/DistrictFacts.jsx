import { useState } from "react";
import { locale, tr } from "../lib/lang.js";
import { money } from "../lib/format.js";

// Census figures for one congressional district. Plain numbers, each with what it measures;
// no rankings or comparisons that suggest a judgment. Source: ACS 5-year estimates.
const num = (n) => (n == null ? "—" : n.toLocaleString(locale()));
const pct = (n) => (n == null ? "—" : `${n.toLocaleString(locale(), { maximumFractionDigits: 1 })}%`);

export const placeList = (places, n = 3) => places.slice(0, n).map((p) => (p.part ? tr(`part of ${p.name}`, `parte de ${p.name}`) : p.name)).join(", ");

export function DistrictFacts({ f, years }) {
  const [allCounties, setAllCounties] = useState(false);
  if (!f) return null;
  const counties = allCounties ? f.counties : f.counties.slice(0, 6);
  return (
    <div className="district-facts">
      <h3 className="small">{tr("About the district", "Sobre el distrito")}</h3>
      <dl className="facts">
        <dt>{tr("Population", "Población")}</dt><dd>{num(f.population)}</dd>
        <dt>{tr("Median age", "Edad mediana")}</dt><dd>{f.median_age == null ? "—" : f.median_age.toLocaleString(locale())}</dd>
        <dt>{tr("Median household income", "Ingreso mediano del hogar")}</dt><dd>{money(f.median_household_income)}</dd>
        <dt>{tr("Median home value", "Valor mediano de la vivienda")}</dt><dd>{money(f.median_home_value)}</dd>
        <dt>{tr("Adults 25+ with a bachelor's degree or higher", "Adultos de 25+ con licenciatura o más")}</dt><dd>{pct(f.bachelors_or_higher)}</dd>
        <dt>{tr("People below the poverty line", "Personas bajo el nivel de pobreza")}</dt><dd>{pct(f.below_poverty)}</dd>
      </dl>
      {f.places.length > 0 && (
        <>
          <h3 className="small">{f.places.some((p) => p.part) ? tr("Includes", "Incluye") : tr("Largest cities and towns", "Ciudades y pueblos más grandes")}</h3>
          <ul className="plain columns">
            {f.places.map((p) => (
              <li key={p.name}>{p.part ? tr(`Part of ${p.name}`, `Parte de ${p.name}`) : p.name} <span className="fine">{p.part ? tr(`(city population ${num(p.population)})`, `(población de la ciudad: ${num(p.population)})`) : num(p.population)}</span></li>
            ))}
          </ul>
        </>
      )}
      {f.counties.length > 0 && (
        <>
          <h3 className="small">{tr("Counties", "Condados")} <span className="fine">{tr("(people living in the district)", "(personas que viven en el distrito)")}</span></h3>
          <ul className="plain columns">
            {counties.map((c) => <li key={c.name}>{c.name} <span className="fine">{num(c.population)}</span></li>)}
          </ul>
          {f.counties.length > 6 && (
            <button type="button" className="link fine" onClick={() => setAllCounties(!allCounties)}>
              {allCounties ? tr("Show fewer", "Mostrar menos") : tr(`Show all ${f.counties.length} counties`, `Mostrar los ${f.counties.length} condados`)}
            </button>
          )}
        </>
      )}
      <p className="fine">
        {tr(`U.S. Census Bureau, American Community Survey ${years} 5-year estimates. These are survey estimates with margins of error. Cities and towns are listed where their center falls inside the district. `,
          `Oficina del Censo de EE. UU., estimaciones de 5 años de la Encuesta sobre la Comunidad Estadounidense ${years}. Son estimaciones de encuesta con márgenes de error. Las ciudades y pueblos se incluyen si su centro está dentro del distrito. `)}
        {f.geoid && <a href={`https://www.census.gov/mycd/?st=${f.geoid.slice(0, 2)}&cd=${f.geoid.slice(2)}`} rel="noopener">{tr("See this district on census.gov", "Ver este distrito en census.gov")}</a>}
      </p>
    </div>
  );
}
