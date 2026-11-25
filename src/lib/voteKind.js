// What kind of vote a roll call is, from the clerk's own question and description.
// The point is to keep procedural votes from being read as votes on a bill itself.
// Labels describe the procedure only; they never characterize the outcome.
//
// kind: passage | nomination | cloture | amendment | procedural | other
import { tr } from "./lang.js";

// Spanish labels and explanations, keyed by the English label.
const ES = {"Organizational": ["Organizativa", "Elegir al Presidente de la Cámara o registrar quién está presente."], "Veto override": ["Anulación del veto", "Si aprobar un proyecto a pesar del veto del Presidente. Requiere dos tercios."], "Final passage (two-thirds)": ["Aprobación final (dos tercios)", "Aprobación con reglas abreviadas: sin enmiendas y con el acuerdo de dos tercios."], "Final passage": ["Aprobación final", null], "Confirmation": ["Confirmación", "Si confirmar a la persona nominada."], "Cloture (to start debate)": ["Cloture (para iniciar el debate)", "Si terminar el debate sobre comenzar a considerar una medida. Requiere 60 votos para la mayoría de los proyectos."], "Cloture": ["Cloture (cierre del debate)", "Si terminar el debate y pasar a una votación final. Requiere 60 votos para la mayoría de los proyectos; mayoría simple para nominaciones."], "Amendment": ["Enmienda", "Si cambiar el texto de un proyecto de ley."], "Procedural: previous question": ["De procedimiento: cuestión previa", "Si terminar el debate sobre una regla de la Cámara y votarla."], "Procedural: recommit": ["De procedimiento: devolver al comité", "Si enviar la medida de vuelta al comité."], "Procedural: table": ["De procedimiento: aplazar", "Si dejar de lado (en la práctica, rechazar) una moción o enmienda."], "Procedural: take up": ["De procedimiento: considerar", "Si comenzar a considerar una medida."], "Procedural: budget waiver": ["De procedimiento: exención presupuestaria", "Si dejar de lado una regla presupuestaria para que avance una enmienda o un proyecto. Suele requerir 60 votos."], "Procedural: discharge": ["De procedimiento: sacar del comité", "Si sacar una medida del comité y llevarla al pleno."], "Procedural": ["De procedimiento", "Una votación sobre cómo procede la cámara, no sobre una medida en sí."]};
// The two "Final passage" rules explain differently; Spanish for each by English explanation.
const ES_EXPLAIN = {
  "Whether to pass the bill or resolution, or agree to the other chamber's version.": "Si aprobar el proyecto o la resolución, o aceptar la versión de la otra cámara.",
  "Whether to adopt the resolution.": "Si adoptar la resolución.",
};
const RULES = [
  // [test, kind, label, explanation]
  [/^Election of the Speaker|^Call (of the House|by States)/i, "other", "Organizational",
    "Electing the Speaker or recording who is present."],
  [/Objections of the President|Notwithstanding/i, "passage", "Veto override",
    "Whether to pass a bill over the President's veto. Needs two-thirds."],
  [/^On Motion to Suspend the Rules/i, "passage", "Final passage (two-thirds)",
    "Passage under expedited rules: no amendments, and two-thirds must agree."],
  [/^On Passage|^Passage|^On Passage of the Bill|^On the (Joint|Concurrent) Resolution|^On the Resolution|^On Motion to Concur|^On the Motion \(Motion to Concur/i,
    "passage", "Final passage", "Whether to pass the bill or resolution, or agree to the other chamber's version."],
  [/^On Agreeing to the Resolution/i, "passage", "Final passage", "Whether to adopt the resolution."],
  [/^On the Nomination/i, "nomination", "Confirmation", "Whether to confirm the nominee."],
  [/^On Cloture on the Motion to Proceed/i, "cloture", "Cloture (to start debate)",
    "Whether to end debate on taking up a measure. Needs 60 votes for most bills."],
  [/^On the Cloture Motion/i, "cloture", "Cloture",
    "Whether to end debate and move toward a final vote. Needs 60 votes for most bills; a simple majority for nominations."],
  [/^On (Agreeing to )?the Amendment|^On Retaining Division/i, "amendment", "Amendment",
    "Whether to change the text of a bill."],
  [/^On Ordering the Previous Question/i, "procedural", "Procedural: previous question",
    "Whether to end debate on a House rule and vote on it."],
  [/Motion to (Re)?commit/i, "procedural", "Procedural: recommit",
    "Whether to send the measure back to committee."],
  [/Motion to Table/i, "procedural", "Procedural: table",
    "Whether to set aside (effectively reject) a motion or amendment."],
  [/^On the Motion to Proceed/i, "procedural", "Procedural: take up",
    "Whether to begin considering a measure."],
  [/Motion to Waive/i, "procedural", "Procedural: budget waiver",
    "Whether to waive a budget rule so an amendment or bill can proceed. Usually needs 60 votes."],
  [/Motion to Discharge/i, "procedural", "Procedural: discharge",
    "Whether to bring a measure out of committee to the floor."],
  [/./, "procedural", "Procedural", "A vote on how the chamber proceeds, not on a measure itself."],
];

// House "rules" set the terms of debate for other bills; they're adopted with the same
// wording as a final resolution vote, so the description tells them apart.
const HOUSE_RULE = /^Providing for (the )?(consideration|further consideration|adoption|proceedings)/i;

export function voteKind(v) {
  const q = String(v.question ?? "");
  if (v.chamber === "house" && /^On (Agreeing to|Consideration of) the Resolution/i.test(q) && HOUSE_RULE.test(v.description ?? "")) {
    return { kind: "procedural", label: tr("Procedural: rule for debate", "De procedimiento: regla para el debate"),
      explain: tr("Sets the terms of debate for another bill. Adopting it is not a vote on that bill.",
        "Fija las condiciones del debate de otro proyecto. Adoptarla no es votar ese proyecto.") };
  }
  const [, kind, label, explain] = RULES.find(([re]) => re.test(q));
  const es = ES[label];
  return { kind, label: tr(label, es?.[0]), explain: tr(explain, es?.[1] ?? ES_EXPLAIN[explain]) };
}

export const isFinal = (v) => ["passage", "nomination"].includes(voteKind(v).kind);

// What a Yea or a Nay meant on this kind of vote: the procedural meaning only, never its effect.
// Keyed by the English label above. [yes, no] in English and Spanish.
const MEANING = {
  "Veto override": [["to override the veto", "to sustain the veto"], ["anular el veto", "mantener el veto"]],
  "Final passage (two-thirds)": [["to pass it under expedited rules", "against passing it"], ["aprobarlo con reglas abreviadas", "en contra de aprobarlo"]],
  "Final passage": [["to pass it", "against passing it"], ["aprobarlo", "en contra de aprobarlo"]],
  "Confirmation": [["to confirm the nominee", "against confirming the nominee"], ["confirmar a la persona nominada", "en contra de confirmarla"]],
  "Cloture (to start debate)": [["to end debate on taking it up", "against ending that debate"], ["terminar el debate sobre considerarlo", "en contra de terminar ese debate"]],
  "Cloture": [["to end debate and move toward a final vote", "against ending debate"], ["terminar el debate y avanzar a una votación final", "en contra de terminar el debate"]],
  "Amendment": [["to adopt the amendment", "against adopting the amendment"], ["adoptar la enmienda", "en contra de adoptar la enmienda"]],
  "Procedural: previous question": [["to end debate on the rule and vote on it", "against ending debate on the rule"], ["terminar el debate sobre la regla y votarla", "en contra de terminar el debate sobre la regla"]],
  "Procedural: recommit": [["to send it back to committee", "against sending it back to committee"], ["devolverlo al comité", "en contra de devolverlo al comité"]],
  "Procedural: table": [["to set the motion aside", "against setting it aside"], ["dejar de lado la moción", "en contra de dejarla de lado"]],
  "Procedural: take up": [["to begin considering it", "against beginning to consider it"], ["comenzar a considerarlo", "en contra de comenzar a considerarlo"]],
  "Procedural: budget waiver": [["to waive the budget rule", "against waiving it"], ["eximir la regla presupuestaria", "en contra de eximirla"]],
  "Procedural: discharge": [["to bring it out of committee", "against bringing it out of committee"], ["sacarlo del comité", "en contra de sacarlo del comité"]],
};
const RULE_MEANING = [["to adopt the terms for debating another bill", "against those terms"], ["adoptar las condiciones para debatir otro proyecto", "en contra de esas condiciones"]];

// "voted Yea: to pass it", "voted Nay: against ending debate". Null when there's no yes/no meaning
// (Speaker elections record names; "Present" and "Not Voting" are said as they are).
export function positionMeaning(v, position) {
  const p = String(position ?? "");
  if (/^Not Voting$/i.test(p)) return tr("didn't vote", "no votó");
  if (/^Present$/i.test(p)) return tr("voted \u201cpresent\u201d (neither yes nor no)", "votó \u201cpresente\u201d (ni sí ni no)");
  const yes = /^(Yea|Aye|Yes|Guilty)$/i.test(p), no = /^(Nay|No|Not Guilty)$/i.test(p);
  if (!yes && !no) return null;
  const q = String(v.question ?? "");
  const isRule = v.chamber === "house" && /^On (Agreeing to|Consideration of) the Resolution/i.test(q) && HOUSE_RULE.test(v.description ?? "");
  const rule = isRule ? RULE_MEANING : MEANING[RULES.find(([re]) => re.test(q))?.[2]];
  if (!rule) return null;
  const [en, es] = rule;
  return tr(en[yes ? 0 : 1], es[yes ? 0 : 1]);
}
