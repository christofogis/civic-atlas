import { tr } from "./lang.js";
import { stateName } from "./format.js";

// Names of state offices and chambers, the same pattern for every state.
const LOWER = {
  CA: ["Assembly", "Asamblea"], NV: ["Assembly", "Asamblea"], NY: ["Assembly", "Asamblea"], WI: ["Assembly", "Asamblea"],
  NJ: ["General Assembly", "Asamblea General"],
  VA: ["House of Delegates", "Cámara de Delegados"], MD: ["House of Delegates", "Cámara de Delegados"], WV: ["House of Delegates", "Cámara de Delegados"],
};
export const lowerChamber = (st) => tr(...(LOWER[st] ?? ["House of Representatives", "Cámara de Representantes"]));

const EXEC = {
  governor: ["Governor", "Gobernador(a)"],
  lt_governor: ["Lieutenant Governor", "Vicegobernador(a)"],
  "attorney general": ["Attorney General", "Fiscal General"],
  "secretary of state": ["Secretary of State", "Secretario(a) de Estado"],
  "chief election officer": ["Chief Election Officer", "Funcionario(a) electoral principal"],
  mayor: ["Mayor", "Alcalde(sa)"],
  treasurer: ["Treasurer", "Tesorero(a)"],
  auditor: ["Auditor", "Auditor(a)"],
};

// As [office, place], for cards on two lines: ["California State Senate", "District 36"],
// ["Governor", "California"]. Joined: "California State Senate, District 36", "Governor, California".
export function stateOfficeParts(role, st) {
  const d = role.district;
  const dist = d ? tr(`District ${d}`, `Distrito ${d}`) : "";
  if (role.type === "upper") return [tr(`${stateName(st)} State Senate`, `Senado de ${stateName(st)}`), dist];
  if (role.type === "lower") return [tr(`${stateName(st)} ${lowerChamber(st)}`, `${lowerChamber(st)} de ${stateName(st)}`), dist];
  if (role.type === "legislature") return st === "DC"
    ? [tr("D.C. Council", "Concejo de D.C."), d ? String(d) : ""]
    : [tr(`${stateName(st)} Legislature`, `Legislatura de ${stateName(st)}`), dist];
  const name = EXEC[role.type];
  return name ? [tr(name[0], name[1]), stateName(st)] : [role.type, ""];
}
// Joined on one line, a district reads lowercase in Spanish after the comma ("Senado de California, distrito 39").
export const stateOfficeLabel = (role, st) => stateOfficeParts(role, st).filter(Boolean).map((x, i) => (i ? x.replace(/^Distrito /, "distrito ") : x)).join(", ");

// Party as published by the state ("Democratic-Farmer-Labor") -> badge letter and color class.
export function stateParty(party) {
  if (!party) return null;
  if (/^Democratic/.test(party)) return { letter: "D", kind: "d" };
  if (/^Republican/.test(party)) return { letter: "R", kind: "r" };
  if (party === "Nonpartisan") return { letter: "NP", kind: "other" };
  return { letter: party[0], kind: "other" };
}
