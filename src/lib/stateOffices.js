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

// "California State Senate, District 36", "California Assembly, District 72", "Governor of California".
export function stateOfficeLabel(role, st) {
  const d = role.district;
  const where = (body) => (d ? tr(`${body}, District ${d}`, `${body}, distrito ${d}`) : body);
  if (role.type === "upper") return where(tr(`${stateName(st)} State Senate`, `Senado de ${stateName(st)}`));
  if (role.type === "lower") return where(tr(`${stateName(st)} ${lowerChamber(st)}`, `${lowerChamber(st)} de ${stateName(st)}`));
  if (role.type === "legislature") return st === "DC"
    ? (d ? tr(`D.C. Council, ${d}`, `Concejo de D.C., ${d}`) : tr("D.C. Council", "Concejo de D.C."))
    : where(tr(`${stateName(st)} Legislature`, `Legislatura de ${stateName(st)}`));
  const name = EXEC[role.type];
  return name ? tr(`${name[0]} of ${stateName(st)}`, `${name[1]} de ${stateName(st)}`) : role.type;
}

// Party as published by the state ("Democratic-Farmer-Labor") -> badge letter and color class.
export function stateParty(party) {
  if (!party) return null;
  if (/^Democratic/.test(party)) return { letter: "D", kind: "d" };
  if (/^Republican/.test(party)) return { letter: "R", kind: "r" };
  if (party === "Nonpartisan") return { letter: "NP", kind: "other" };
  return { letter: party[0], kind: "other" };
}
