// One plain sentence per roll call: what a Yes vote was for, and what the recorded result did.
// Built only from templates keyed on the clerk's own question, the official result and the
// measure it names, so every vote of the same kind reads the same way for every member and party.
// It never paraphrases a bill, guesses intent, or says whether an outcome was good or bad.
// Anything not recognized falls back to the official question and result, as worded.
//
// voteMeaning(v, lang) -> { kind, text, fallback }
//   v: a votes row (chamber, question, result, description, document_name, bill_type, bill_number,
//      amendment_ref, required, yea_total, nay_total); missing fields are fine.
import { getLang } from "./lang.js";

const HOUSE_RULE = /^Providing for (the )?(consideration|further consideration|adoption|proceedings)/i;

const BILL_LABEL = { hr: "H.R.", s: "S.", hres: "H.Res.", sres: "S.Res.", hjres: "H.J.Res.", sjres: "S.J.Res.", hconres: "H.Con.Res.", sconres: "S.Con.Res." };

// "H R 30", "H.R. 30", "S J RES 24", "H.J. Res. 45", "S.2" -> { type: "hr", number: 30 }
export function parseMeasure(text) {
  const m = String(text ?? "").match(/\b(H|S)\.?\s?(R|RES|J\.?\s?RES|CON\.?\s?RES)?\.?\s?(\d+)\b/i);
  if (!m) return null;
  const mid = (m[2] ?? "").toUpperCase().replace(/[.\s]/g, "");
  const type = m[1].toLowerCase() + ({ "": "", R: "r", RES: "res", JRES: "jres", CONRES: "conres" }[mid] ?? "");
  if (!BILL_LABEL[type] || (type === "s" && m[2])) return null;
  return { type, number: Number(m[3]) };
}

function measureOf(v) {
  if (v.bill_type && v.bill_number) return { type: v.bill_type, number: v.bill_number };
  // Senate questions name the measure last ("... to H.R. 4366 (title)"); House rows use document_name.
  const q = String(v.question ?? "").replace(/S\.\s?Amdt\.\s?\d+/gi, "").replace(/Amdt\.?\s?No\.?\s?\d+/gi, "");
  const all = [...q.matchAll(/\b(H|S)\.?\s?(R|J\.?\s?Res|Con\.?\s?Res|Res)?\.?\s?\d+\b/gi)].map((x) => parseMeasure(x[0])).filter(Boolean);
  return all.at(-1) ?? parseMeasure(v.document_name);
}

const label = (m) => (m ? `${BILL_LABEL[m.type]} ${m.number}` : null);

function amendmentOf(v) {
  const m = `${v.amendment_ref ?? ""} ${v.question ?? ""}`.match(/(?:S\.\s?Amdt\.|Amdt\.?\s?No\.?)\s?(\d+)/i);
  return m ? `S.Amdt. ${m[1]}` : null;
}

// The nominee's name from the Senate's description: "Confirmation: Jane Doe, of Ohio, to be ...".
function nomineeOf(v) {
  if (/ and PN\d/i.test(v.question ?? "")) return null; // nominations voted en bloc
  const d = String(v.description ?? "").replace(/^(Confirmation|Motion to Invoke Cloture):?\s*/i, "");
  const m = d.match(/^(.+?)(?:, of [^,]+,| to be )/);
  return m && m[1].length <= 60 ? m[1].trim() : null;
}

// Passed / failed from the official result wording. null when it can't be read.
export function outcome(result) {
  const r = String(result ?? "");
  if (/\b(Failed|Rejected|Defeated|Not Sustained|Not Well Taken)\b|^Veto Sustained/i.test(r)) return "failed";
  if (/\b(Passed|Agreed to|Confirmed|Well Taken|Sustained|Overridden)\b/i.test(r)) return "passed";
  return null;
}

// Yea–nay from the totals, or from the Senate's "(51-43, ...)" in the result.
function count(v) {
  if (v.yea_total != null && v.nay_total != null) return `${v.yea_total}–${v.nay_total}`;
  const m = String(v.result ?? "").match(/\((\d+)-(\d+)/);
  return m ? `${m[1]}–${m[2]}` : null;
}

// The threshold the record itself states (Senate results say "3/5 majority required").
function statedThreshold(v) {
  const m = String(v.result ?? "").match(/(\d\/\d) majority required/i);
  return m?.[1] ?? (v.required && v.required !== "1/2" ? v.required : null);
}

const otherChamber = (c, es) => (c === "house" ? (es ? "el Senado" : "the Senate") : (es ? "la Cámara" : "the House"));

// [test(q, v), kind]. Order matters: the first match wins.
const KINDS = [
  [(q) => /^Election of the Speaker/i.test(q), "speaker"],
  [(q) => /^Call (of the House|by States)/i.test(q), "quorum"],
  [(q) => /Objections of the President|Notwithstanding|^On Overriding the Veto/i.test(q), "veto"],
  [(q) => /^On Motion to Suspend the Rules and Concur/i.test(q), "suspend-concur"],
  [(q) => /^On Motion to Suspend the Rules and Agree to the Conference Report/i.test(q), "suspend-conference"],
  [(q) => /^On Motion to Suspend the Rules and Agree/i.test(q), "suspend-agree"],
  [(q) => /^On Motion to Suspend the Rules and Pass/i.test(q), "suspend-pass"],
  [(q) => /^(On (Agreeing to )?the Conference Report)/i.test(q), "conference"],
  [(q) => /^On the Resolution of Ratification/i.test(q), "treaty"],
  [(q) => /^On Cloture on the Motion to Proceed/i.test(q), "cloture-proceed"],
  [(q) => /^On the Cloture Motion/i.test(q), "cloture"],
  [(q) => /^On the Nomination/i.test(q), "nomination"],
  [(q) => /Motion to Concur/i.test(q), "concur"],
  [(q) => /^(Table Motion|On (the )?Motion to Table)/i.test(q), "table"],
  [(q) => /Motion to Recommit/i.test(q), "recommit"],
  [(q) => /Motion to Commit/i.test(q), "commit"],
  [(q) => /Motion to Refer/i.test(q), "refer"],
  [(q) => /Motion to (\s)*Waive/i.test(q), "waive"],
  [(q) => /^On (the )?Motion to Discharge/i.test(q), "discharge"],
  [(q) => /^On the Motion to Proceed|^On the Motion \(Motion to Proceed to (?!(Executive|Legislative) Session)/i.test(q) && !/Motion to Proceed \(Motion to Proceed to (Executive|Legislative)/i.test(q), "proceed"],
  [(q) => /Motion to Adjourn/i.test(q), "adjourn"],
  [(q) => /Motion to Recess/i.test(q), "recess"],
  [(q) => /Motion to Reconsider/i.test(q), "reconsider"],
  [(q) => /^On the Decision of the Chair/i.test(q), "chair"],
  [(q) => /^On Ordering the Previous Question/i.test(q), "previous-question"],
  [(q, v) => v.chamber === "house" && /^On (Agreeing to|Consideration of) the Resolution/i.test(q) && HOUSE_RULE.test(v.description ?? ""), "rule"],
  [(q) => /^On Consideration of the Resolution/i.test(q), "consideration"],
  [(q) => /^On (Agreeing to )?the Amendment/i.test(q), "amendment"],
  [(q) => /^On Passage|^Passage|^On the Joint Resolution/i.test(q), "passage"],
  [(q) => /^On (Agreeing to )?the (Concurrent )?Resolution/i.test(q), "adopt"],
];

export function meaningKind(v) {
  const q = String(v.question ?? "").trim();
  return KINDS.find(([t]) => t(q, v))?.[1] ?? null;
}

export function voteMeaning(v, lang = getLang()) {
  const es = lang === "es";
  const L = (en, sp) => (es ? sp : en);
  const kind = meaningKind(v);
  const res = outcome(v.result);
  const n = count(v);
  const m = label(measureOf(v));
  const it = m ?? L("the measure", "la medida");
  const stated = statedThreshold(v);
  const fallback = () => ({
    kind: null, fallback: true,
    text: L(`The question was: ${String(v.question ?? "").trim()}. Result: ${v.result ?? ""}.`,
      `La pregunta fue: ${String(v.question ?? "").trim()}. Resultado: ${v.result ?? ""}.`),
  });
  if (!kind) return fallback();

  if (kind === "speaker") return { kind, fallback: false, text: L("Each member named a candidate for Speaker; there was no Yes or No.", "Cada miembro nombró a un candidato a Presidente de la Cámara; no hubo Sí ni No.") };
  if (kind === "quorum") return { kind, fallback: false, text: L("A quorum call: members recorded that they were present; there was no Yes or No.", "Llamada de quórum: los miembros registraron su presencia; no hubo Sí ni No.") };

  const nominee = nomineeOf(v);
  const pn = String(v.document_name ?? v.question ?? "").match(/PN\d+(-\d+)?/)?.[0];
  const nom = nominee ?? (/ and PN\d/i.test(v.question ?? "") ? L("a group of nominations", "un grupo de nominaciones") : L(`the nomination${pn ? ` ${pn}` : ""}`, `la nominación${pn ? ` ${pn}` : ""}`));
  const amdt = amendmentOf(v);
  const amdtName = amdt ? L(`amendment ${amdt}`, `la enmienda ${amdt}`) : L("the amendment", "la enmienda");
  const withAmdt = /with (an )?Amendment|with .*Amdt/i.test(v.question ?? "");
  const isNom = /PN\d/.test(`${v.question ?? ""} ${v.document_name ?? ""}`);
  const isTreaty = /Treaty Doc/i.test(v.question ?? "");

  // [what a Yes vote was for, fixed-rule threshold or null, [if passed, if failed] consequence]
  const TWO_THIRDS = L("two-thirds", "dos tercios");
  const SIXTY = L("60 votes", "60 votos");
  let yes, rule = null, next = [null, null];
  switch (kind) {
    case "veto":
      yes = L(`to pass ${it} over the President's veto`, `aprobar ${it} a pesar del veto del Presidente`);
      rule = TWO_THIRDS; next = [null, L("so the veto stands", "así que el veto se mantiene")]; break;
    case "suspend-pass":
      yes = L(`to pass ${it} under expedited rules (suspension of the rules)`, `aprobar ${it} con reglas abreviadas (suspensión de las reglas)`);
      rule = TWO_THIRDS; break;
    case "suspend-agree":
      yes = L(`to adopt ${it} under expedited rules (suspension of the rules)`, `adoptar ${it} con reglas abreviadas (suspensión de las reglas)`);
      rule = TWO_THIRDS; break;
    case "suspend-concur":
      yes = L(`to accept the Senate's changes to ${it} under expedited rules (suspension of the rules)`, `aceptar los cambios del Senado a ${it} con reglas abreviadas (suspensión de las reglas)`);
      rule = TWO_THIRDS; break;
    case "suspend-conference":
      yes = L(`to approve the final House–Senate version of ${it} (conference report) under expedited rules`, `aprobar la versión final acordada por la Cámara y el Senado de ${it} (informe de conferencia) con reglas abreviadas`);
      rule = TWO_THIRDS; break;
    case "conference":
      yes = L(`to approve the final version of ${it} agreed by House and Senate negotiators (conference report)`, `aprobar la versión final de ${it} acordada por negociadores de la Cámara y el Senado (informe de conferencia)`); break;
    case "treaty":
      yes = L("to approve the treaty (resolution of ratification)", "aprobar el tratado (resolución de ratificación)");
      rule = L("two-thirds of senators present", "dos tercios de los senadores presentes"); break;
    case "cloture-proceed":
      yes = L(`to end debate on whether to take up ${it} (cloture)`, `terminar el debate sobre si considerar ${it} (cloture)`);
      rule = SIXTY;
      next = [L("so the Senate can vote on taking it up", "así que el Senado puede votar si lo considera"), L("so debate on taking it up continues", "así que el debate sobre considerarlo continúa")]; break;
    case "cloture": {
      const what = isNom ? (nominee ? L(`the nomination of ${nominee}`, `la nominación de ${nominee}`) : nom)
        : isTreaty ? L("the treaty", "el tratado") : amdt ? amdtName : it;
      yes = L(`to end debate on ${what} (cloture)`, `terminar el debate sobre ${what} (cloture)`);
      rule = isNom ? L("a simple majority", "mayoría simple") : SIXTY;
      next = [L("so debate is limited and a vote can follow", "así que el debate se limita y puede seguir una votación"), L("so debate continues", "así que el debate continúa")]; break;
    }
    case "nomination":
      yes = L(`to confirm ${nom}`, `confirmar ${nominee ? `a ${nominee}` : nom}`); break;
    case "concur":
      yes = withAmdt
        ? L(`to accept ${otherChamber(v.chamber)}'s changes to ${it}, with further changes`, `aceptar los cambios de ${otherChamber(v.chamber, true)} a ${it}, con más cambios`)
        : L(`to accept ${otherChamber(v.chamber)}'s changes to ${it}`, `aceptar los cambios de ${otherChamber(v.chamber, true)} a ${it}`); break;
    case "table": {
      const target = /Point of Order/i.test(v.question ?? "") ? L("the point of order", "la cuestión de orden")
        : /Motion to Table the Motion to (\w+)/i.test(v.question ?? "") ? L("the pending motion", "la moción pendiente")
        : /Motion to Reconsider/i.test(v.question ?? "") ? L("the motion to reconsider", "la moción de reconsiderar")
        : amdt ? amdtName : L("the pending motion", "la moción pendiente");
      yes = L(`to table (set aside) ${target}`, `aplazar (dejar de lado) ${target}`);
      next = [L("so it was set aside", "así que se dejó de lado"), L("so it is still pending", "así que sigue pendiente")]; break;
    }
    case "recommit":
      yes = L(`to send ${it} back to committee (motion to recommit)`, `devolver ${it} al comité (moción para devolver al comité)`); break;
    case "commit":
      yes = L(`to send ${it} to committee (motion to commit)`, `enviar ${it} a un comité (moción para enviar al comité)`); break;
    case "refer":
      yes = L(`to refer ${it} to committee (motion to refer)`, `remitir ${it} a un comité (moción para remitir)`); break;
    case "waive":
      yes = /Budget|CBA|C\.B\.A\./i.test(v.question ?? "")
        ? L(`to waive a budget rule (point of order) so ${amdt ? amdtName : it} can proceed`, `dejar sin efecto una regla presupuestaria (cuestión de orden) para que ${amdt ? amdtName : it} pueda avanzar`)
        : L(`to waive a Senate rule (point of order) so ${amdt ? amdtName : it} can proceed`, `dejar sin efecto una regla del Senado (cuestión de orden) para que ${amdt ? amdtName : it} pueda avanzar`); break;
    case "discharge":
      yes = L(`to take ${it} out of committee and bring it to the floor (motion to discharge)`, `sacar ${it} del comité y llevarlo al pleno (moción para sacar del comité)`); break;
    case "proceed":
      yes = isNom ? L(`to begin considering ${nom} (motion to proceed)`, `comenzar a considerar ${nom} (moción para proceder)`)
        : L(`to begin considering ${it} (motion to proceed)`, `comenzar a considerar ${it} (moción para proceder)`);
      next = [L("so the Senate takes it up", "así que el Senado lo considera"), null]; break;
    case "adjourn":
      yes = L("to adjourn", "levantar la sesión"); break;
    case "recess":
      yes = L("to recess (pause the session)", "hacer un receso (pausar la sesión)"); break;
    case "reconsider":
      yes = L("to reconsider (vote again on) the earlier vote", "reconsiderar (volver a votar) la votación anterior"); break;
    case "chair":
      yes = L("to uphold the presiding officer's ruling", "mantener la decisión de quien preside"); break;
    case "previous-question":
      yes = L(`to end debate on the rule${m ? ` ${m}` : ""} and vote on it (ordering the previous question)`, `terminar el debate sobre la regla${m ? ` ${m}` : ""} y votarla (cuestión previa)`);
      next = [L("so the House moves to a vote on the rule", "así que la Cámara pasa a votar la regla"), null]; break;
    case "rule":
      yes = L(`to adopt ${it}, a rule that sets the terms for debating other legislation; it is not a vote on that legislation`, `adoptar ${it}, una regla que fija las condiciones para debatir otra legislación; no es una votación sobre esa legislación`); break;
    case "consideration":
      yes = L(`to take up ${it} now (question of consideration)`, `considerar ${it} ahora (cuestión de consideración)`); break;
    case "amendment":
      yes = m ? L(`to adopt ${amdt ? amdtName : "an amendment"} to ${m}`, `adoptar ${amdt ? amdtName : "una enmienda"} a ${m}`)
        : L(`to adopt ${amdtName}`, `adoptar ${amdtName}`); break;
    case "passage":
      yes = L(`to pass ${it}`, `aprobar ${it}`); break;
    case "adopt":
      yes = L(`to adopt ${it}`, `adoptar ${it}`); break;
    default: return fallback();
  }

  // What happens next after passage, only where the measure's own type settles it: a measure
  // goes to the other chamber after the chamber it started in passes it; a one-chamber
  // resolution needs no other vote. Nothing is said about the President or the other
  // chamber's later action, which this record doesn't show.
  if (["passage", "adopt", "suspend-pass", "suspend-agree"].includes(kind)) {
    const mt = measureOf(v)?.type;
    if (mt === "hres" || mt === "sres") {
      next = [L("It is a one-chamber resolution, so no other vote is needed", "Es una resolución de una sola cámara, así que no se necesita otra votación"), null];
    } else if (mt) {
      const startedHere = mt.startsWith(v.chamber === "house" ? "h" : "s");
      next = [startedHere ? L(`so it goes to ${otherChamber(v.chamber)}`, `así que pasa a ${otherChamber(v.chamber, true)}`)
        : L(`It had already passed ${otherChamber(v.chamber)}`, `Ya había sido aprobado por ${otherChamber(v.chamber, true)}`), null];
    }
  }

  // Threshold: the one the record states, else the fixed rule for this kind of vote.
  const th = stated === "3/5" ? SIXTY : stated === "2/3" ? (kind === "treaty" ? rule : TWO_THIRDS) : rule;
  let text = L(`A Yes vote was ${yes}`, `Votar Sí significaba ${yes}`) + (th ? L(`, which needs ${th}.`, `, lo que requiere ${th}.`) : ".");

  if (res) {
    const vp = /Vice President.*voted/i.test(v.result ?? "") ? L(", with the Vice President breaking the tie", ", con el voto de desempate del Vicepresidente") : "";
    let head;
    if (kind === "nomination") head = res === "passed" ? L("The nominee was confirmed", "La persona nominada fue confirmada") : L("The nominee was not confirmed", "La persona nominada no fue confirmada");
    else if (kind === "amendment") head = res === "passed" ? L("It was adopted", "Se adoptó") : L("It failed", "No se adoptó");
    else head = res === "passed" ? L("It passed", "Se aprobó") : L("It failed", "No se aprobó");
    if (isNom && /PN\d+.* and PN\d/i.test(v.question ?? "") && kind === "nomination") head = res === "passed" ? L("They were confirmed", "Fueron confirmadas") : L("They were not confirmed", "No fueron confirmadas");
    const after = next[res === "passed" ? 0 : 1];
    // A consequence that starts with "so" continues the sentence; anything else is its own sentence.
    const joined = after && /^(so|así)/.test(after) ? `, ${after}` : "";
    text += ` ${head}${n ? `, ${n}` : ""}${vp}${joined}.`;
    if (after && !joined) text += ` ${after}.`;
  }
  // Spanish contractions after a chamber name: "a el Senado" -> "al Senado".
  if (es) text = text.replace(/\ba el\b/g, "al").replace(/\bde el\b/g, "del");
  return { kind, fallback: false, text };
}
