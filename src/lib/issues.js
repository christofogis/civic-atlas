// "Issues you care about": everyday names for the Library of Congress policy areas stored on each
// bill. The names describe a subject only; each issue lists the official policy areas it covers, and
// the page shows them, so a reader can see exactly what is counted. Policy areas that no issue covers
// are listed under "More topics" with their official names, so every area is reachable.
import { POLICY_AREAS } from "./policyAreas.js";

export const ISSUES = [
  { id: "education", en: "Schools, college and student loans", es: "Escuelas, universidad y préstamos estudiantiles", areas: ["Education"] },
  { id: "jobs", en: "Jobs and pay", es: "Empleo y salarios", areas: ["Labor and Employment"] },
  { id: "health", en: "Health care", es: "Salud y atención médica", areas: ["Health"] },
  { id: "taxes", en: "Taxes", es: "Impuestos", areas: ["Taxation"] },
  { id: "housing", en: "Housing", es: "Vivienda", areas: ["Housing and Community Development"] },
  { id: "immigration", en: "Immigration", es: "Inmigración", areas: ["Immigration"] },
  { id: "crime", en: "Crime, policing and guns", es: "Delito, policía y armas", areas: ["Crime and Law Enforcement"] },
  { id: "environment", en: "Environment and energy", es: "Medio ambiente y energía", areas: ["Environmental Protection", "Energy"] },
  { id: "tech", en: "Science, tech and the internet", es: "Ciencia, tecnología e internet", areas: ["Science, Technology, Communications"] },
  { id: "military", en: "Military and veterans", es: "Fuerzas armadas y veteranos", areas: ["Armed Forces and National Security"] },
  { id: "budget", en: "Federal budget and spending", es: "Presupuesto y gasto federal", areas: ["Economics and Public Finance"] },
  { id: "social-security", en: "Social Security and public assistance", es: "Seguro Social y asistencia pública", areas: ["Social Welfare"] },
  { id: "civil-rights", en: "Civil rights and liberties", es: "Derechos civiles y libertades", areas: ["Civil Rights and Liberties, Minority Issues"] },
  { id: "transportation", en: "Roads, transit and travel", es: "Carreteras, transporte y viajes", areas: ["Transportation and Public Works"] },
  { id: "farming", en: "Farming and food", es: "Agricultura y alimentos", areas: ["Agriculture and Food"] },
  { id: "foreign", en: "Foreign policy and trade", es: "Política exterior y comercio", areas: ["International Affairs", "Foreign Trade and International Finance"] },
];

// Policy areas no issue covers, in the Library of Congress's order, shown with their official names.
const covered = new Set(ISSUES.flatMap((i) => i.areas));
export const MORE_TOPICS = POLICY_AREAS.filter((a) => !covered.has(a));

export const MAX_PICKS = 3;
export const STORAGE_KEY = "civic-atlas:issues";
const byId = new Map(ISSUES.map((i) => [i.id, i]));
export const issueById = (id) => byId.get(id) ?? null;

// Known ids only, no repeats, at most MAX_PICKS: stored values from an older list stay harmless.
export function cleanPicks(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter((id) => byId.has(id)))].slice(0, MAX_PICKS);
}

// Tapping an issue adds it, or removes it if already picked. A fourth pick is ignored.
export function togglePick(picks, id) {
  if (!byId.has(id)) return picks;
  if (picks.includes(id)) return picks.filter((x) => x !== id);
  return picks.length >= MAX_PICKS ? picks : [...picks, id];
}

// Saved on this device only. Storage can be off (private mode, blocked cookies): then picks last
// for the visit.
export function readPicks(storage = globalThis.localStorage) {
  try { return cleanPicks(JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]")); } catch { return []; }
}
export function savePicks(picks, storage = globalThis.localStorage) {
  try {
    if (picks.length) storage?.setItem(STORAGE_KEY, JSON.stringify(cleanPicks(picks)));
    else storage?.removeItem(STORAGE_KEY);
  } catch { /* storage unavailable */ }
}

export const WINDOW_DAYS = 30;

// The first day of the window, as YYYY-MM-DD (UTC), counting today as one of the days.
export function windowStart(today = new Date(), days = WINDOW_DAYS) {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (days - 1) * 864e5);
  return d.toISOString().slice(0, 10);
}

// A bill "moved" in the window if it reached a step on its track then: reported by a committee,
// a vote in either chamber (passed or failed), sent to the President, signed or vetoed.
// Introduction alone isn't counted. Returned as a PostgREST or= filter.
export const STEP_COLUMNS = ["reported_date", "passed_house_date", "failed_house_date", "passed_senate_date",
  "failed_senate_date", "presented_date", "vetoed_date", "became_law_date"];
export const movedFilter = (since) => STEP_COLUMNS.map((c) => `${c}.gte.${since}`).join(",");

// The date of the latest step a bill reached, for sorting a short list.
export function latestStep(b) {
  return STEP_COLUMNS.map((c) => b?.[c]).filter(Boolean).sort().at(-1) ?? null;
}

const plural = (n, one, many) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

// The one-line summary: "In the last 30 days: 3 bills moved, 5 roll-call votes, 1 became law."
export function summaryLine({ bills = 0, votes = 0, laws = 0 }, days = WINDOW_DAYS) {
  if (!bills && !votes && !laws) {
    return { en: `Nothing recorded in the last ${days} days.`, es: `Nada registrado en los últimos ${days} días.` };
  }
  return {
    en: `In the last ${days} days: ${plural(bills, "bill moved", "bills moved")}, ${plural(votes, "roll-call vote", "roll-call votes")}, ${plural(laws, "became law", "became law")}.`,
    es: `En los últimos ${days} días: ${plural(bills, "proyecto avanzó", "proyectos avanzaron")}, ${plural(votes, "votación nominal", "votaciones nominales")}, ${plural(laws, "se convirtió en ley", "se convirtieron en ley")}.`,
  };
}
