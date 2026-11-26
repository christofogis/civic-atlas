// Where a bill stands, from the milestones stored on each bill (lib/billprogress.js reads them
// from the Library of Congress action codes in GovInfo Bill Status), the committee referrals,
// the roll calls linked to the bill and the official floor/committee schedules. Nothing is
// inferred beyond the record: a step whose date isn't in it is "unknown", not assumed.
//
// Step states: done · failed · current (where the bill is now, or the next step it needs) ·
// todo (not reached) · unknown (a later step happened but this one's date isn't in the record) ·
// no_report (committee only: the bill moved on with no committee report in the record).
import { congressOn } from "./congress.js";

const CHAMBER = { house: { en: "House", es: "la Cámara" }, senate: { en: "Senate", es: "el Senado" } };

// A joint resolution whose official title proposes a constitutional amendment goes to the states.
export const isAmendment = (b) =>
  (b?.bill_type === "hjres" || b?.bill_type === "sjres") && /proposing an amendment to the constitution/i.test(String(b?.title ?? ""));

export function trackKind(b) {
  const t = b?.bill_type;
  if (t === "hres" || t === "sres") return "res";
  if (t === "hconres" || t === "sconres") return "conres";
  if ((t === "hjres" || t === "sjres") && isAmendment(b)) return "amendment";
  return "bill"; // hr, s, and other joint resolutions (they go to the President like bills)
}

const etDay = (ts) => (ts ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(ts)) : null);
const PASSAGE = /passage|suspend the rules and (pass|agree)|agreeing to the (resolution|concurrent resolution|joint resolution)|^on the (joint |concurrent )?resolution\b/i;

// The roll call that passed (or failed) a chamber step: same chamber, same Eastern day, a passage
// question. Linked only when exactly one roll call fits; otherwise none (it may have been a voice vote).
function passageVote(votes, chamber, day) {
  if (!day) return null;
  const hits = (votes ?? []).filter((v) => v.chamber === chamber && etDay(v.voted_at) === day && PASSAGE.test(String(v.question ?? "")));
  return hits.length === 1 ? { vote_id: hits[0].vote_id, source_url: hits[0].source_url } : null;
}

export function billTrack(b, { referrals = [], votes = [], scheduled = [], today = new Date() } = {}) {
  const kind = trackKind(b);
  const origin = String(b?.bill_type ?? "").startsWith("s") ? "senate" : "house";
  const other = origin === "house" ? "senate" : "house";
  const agreed = kind === "res" || kind === "conres";
  const referredDate = referrals.map((r) => r.first_activity_date).filter(Boolean).sort()[0] ?? null;

  const chamberStep = (ch) => {
    const passed = b[`passed_${ch}_date`] ?? null, failed = b[`failed_${ch}_date`] ?? null;
    const name = CHAMBER[ch].en;
    return {
      key: ch, chamber: ch,
      label: passed ? (agreed ? `Agreed to in ${name}` : `Passed ${name}`) : failed ? `Failed in ${name}` : agreed ? `Agreed to in ${name}` : `Passed ${name}`,
      pendingLabel: `${name} vote`,
      date: passed ?? failed, failed: !passed && Boolean(failed),
      vote: passageVote(votes, ch, passed ?? failed),
    };
  };

  const steps = [
    { key: "introduced", label: "Introduced", pendingLabel: "Introduced", date: b.introduced_date ?? null },
    { key: "committee", label: "Reported by committee", pendingLabel: "Committee", date: b.reported_date ?? null, referredDate },
    chamberStep(origin),
  ];
  if (kind !== "res") steps.push(chamberStep(other));
  if (kind === "bill") {
    steps.push({ key: "president", label: "To President", pendingLabel: "To President", date: b.presented_date ?? null });
    const law = b.became_law_date ?? null, veto = b.vetoed_date ?? null;
    steps.push(law || !veto
      ? { key: "law", label: "Became law", pendingLabel: "Becomes law", date: law, law_number: b.law_number ?? null }
      : { key: "law", label: "Vetoed", pendingLabel: "Becomes law", date: veto, failed: true });
  }
  // State ratification isn't in any record we load, so this step never has a date.
  if (kind === "amendment") steps.push({ key: "states", label: "Ratified by the states", pendingLabel: "To the states", date: null, notInRecord: true });

  // Furthest step the record shows.
  const last = steps.reduce((n, s, i) => (s.date ? i : n), -1);
  steps.forEach((s, i) => {
    if (s.date) s.state = s.failed ? "failed" : "done";
    else if (i < last) s.state = s.key === "committee" ? "no_report" : "unknown";
    else s.state = "todo";
  });

  const endedCongress = Number(b.congress) < congressOn(today);
  const both = kind !== "res" && steps.filter((s) => s.chamber).every((s) => s.state === "done");
  const lastStep = steps[last];
  let status;
  if (b.became_law_date) status = "law";
  else if (kind === "bill" && b.vetoed_date) status = "vetoed";
  else if (kind === "res" && steps[2].state === "done") status = "agreed";
  else if (kind === "conres" && both) status = "agreed";
  else if (kind === "amendment" && both) status = "to_states";
  else if (lastStep?.state === "failed") status = "failed";
  else if (last < 0) status = "unknown";
  else status = "pending";
  if (endedCongress && (status === "pending" || status === "failed" || status === "vetoed")) status = status === "pending" ? "ended" : status;

  // The current step: the next one for a bill still moving; otherwise the last one reached.
  let current = last;
  if (status === "pending" || status === "to_states") {
    current = steps.findIndex((s, i) => i > last && s.state === "todo");
    if (current < 0) current = last;
    else steps[current].state = "current";
  }

  // Scheduled action for the current step, from the official schedules already loaded.
  const cur = steps[current];
  let upcoming = null;
  if (status === "pending" && cur) {
    if (cur.chamber) upcoming = scheduled.find((e) => e.kind === "floor" && e.chamber === cur.chamber) ?? null;
    else if (cur.key === "committee") upcoming = scheduled.find((e) => e.kind === "markup") ?? null;
  }

  return { kind, origin, status, steps, current, endedCongress, upcoming, congress: Number(b.congress) };
}

// Ordinal for the sentence about a past Congress ("118th").
const ord = (n) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th")}`;

// One plain sentence (or two) on where the bill stands and what happens next, in English and
// Spanish. `fmt` formats a YYYY-MM-DD date for display.
export function trackSentence(t, fmt = (d) => d) {
  const s = t.steps, cur = s[t.current];
  const lastDone = [...s].reverse().find((x) => x.date);
  const ended = { en: ` The ${ord(t.congress)} Congress ended without it ${t.kind === "res" || t.kind === "conres" ? "being agreed to" : t.kind === "amendment" ? "passing both chambers" : "becoming law"}.`,
    es: ` El ${t.congress}.º Congreso terminó sin que ${t.kind === "res" || t.kind === "conres" ? "fuera adoptado" : t.kind === "amendment" ? "lo aprobaran ambas cámaras" : "se convirtiera en ley"}.` };
  const reintro = { en: " To move forward it would have to be introduced again.", es: " Para avanzar tendría que presentarse de nuevo." };
  const out = (en, es) => ({ en, es });
  switch (t.status) {
    case "law": {
      const law = s.find((x) => x.key === "law");
      const n = law?.law_number ? ` (${law.law_number})` : "";
      return out(`Became law on ${fmt(law.date)}${n}.`, `Se convirtió en ley el ${fmt(law.date)}${n}.`);
    }
    case "vetoed": {
      const v = s.find((x) => x.key === "law");
      const head = out(`Vetoed on ${fmt(v.date)}.`, `Vetado el ${fmt(v.date)}.`);
      if (t.endedCongress) return out(head.en + ended.en, head.es + ended.es);
      return out(`${head.en} It becomes law only if two-thirds of both the House and the Senate vote to override the veto.`,
        `${head.es} Solo se convierte en ley si dos tercios de la Cámara y del Senado votan para anular el veto.`);
    }
    case "agreed":
      if (t.kind === "res") return out(`${s[2].label} on ${fmt(s[2].date)}. A simple resolution needs only one chamber.`,
        `Adoptado por ${CHAMBER[s[2].chamber].es} el ${fmt(s[2].date)}. Una resolución simple solo necesita una cámara.`);
      return out(`Agreed to by both chambers; the second on ${fmt(lastDone.date)}. Concurrent resolutions don't go to the President.`,
        `Adoptado por ambas cámaras; la segunda, el ${fmt(lastDone.date)}. Las resoluciones concurrentes no se envían al Presidente.`);
    case "to_states":
      return out(`Passed both chambers; the second on ${fmt(lastDone.date)}. A constitutional amendment takes effect when three-fourths of the states ratify it; state ratification isn't in the records we use.`,
        `Aprobado por ambas cámaras; la segunda, el ${fmt(lastDone.date)}. Una enmienda constitucional entra en vigor cuando la ratifican tres cuartas partes de los estados; la ratificación estatal no está en los registros que usamos.`);
    case "failed": {
      const f = s.find((x) => x.state === "failed");
      const head = out(`Failed in the ${CHAMBER[f.chamber].en} on ${fmt(f.date)}.`, `Rechazado en ${CHAMBER[f.chamber].es} el ${fmt(f.date)}.`);
      if (t.endedCongress) return out(head.en + ended.en, head.es + ended.es);
      return out(`${head.en} The record shows no later step.`, `${head.es} El registro no muestra ningún paso posterior.`);
    }
    case "ended":
      return out(ended.en.trim() + reintro.en, ended.es.trim() + reintro.es);
    case "unknown":
      return out("Where it stands can't be determined from the record we have.", "No se puede determinar en qué etapa está con el registro que tenemos.");
    default: break;
  }
  // Still moving in the current Congress.
  const verb = t.kind === "res" || t.kind === "conres" ? { en: "agree to it", es: "adoptarlo" } : { en: "pass it", es: "aprobarlo" };
  let next;
  if (cur.key === "committee" || cur.chamber) {
    const ch = cur.chamber ?? t.origin;
    next = out(`Next: the ${CHAMBER[ch].en} would need to ${verb.en}.`, `Siguiente paso: ${CHAMBER[ch].es} tendría que ${verb.es}.`);
    const e = t.upcoming;
    if (e && e.kind === "floor") {
      next = out(`${next.en} Scheduled for a House vote the week of ${fmt(e.event_date)}.`, `${next.es} Está en la agenda del pleno de la Cámara para la semana del ${fmt(e.event_date)}.`);
    } else if (e && e.kind === "markup") {
      next = out(`${next.en} A committee markup listing it is scheduled for ${fmt(e.event_date)}.`, `${next.es} Hay una sesión de enmiendas de un comité que lo incluye, programada para el ${fmt(e.event_date)}.`);
    } else if (ch === "house" && cur.chamber) {
      next = out(`${next.en} No House vote on it is scheduled.`, `${next.es} No hay una votación de la Cámara programada.`);
    } else if (cur.chamber) {
      next = out(`${next.en} No Senate vote on it has been announced in the schedules we track.`, `${next.es} No se ha anunciado una votación del Senado en las agendas que seguimos.`);
    }
  } else if (cur.key === "president") {
    next = out("Both chambers have passed it. Next: once both have passed the same text, it is sent to the President.",
      "Ambas cámaras lo aprobaron. Siguiente paso: cuando ambas hayan aprobado el mismo texto, se envía al Presidente.");
  } else if (cur.key === "law") {
    next = out(`Sent to the President on ${fmt(s.find((x) => x.key === "president").date)}. Next: the President signs or vetoes it. If the President does neither within 10 days (Sundays excepted), it becomes law, unless Congress has adjourned.`,
      `Enviado al Presidente el ${fmt(s.find((x) => x.key === "president").date)}. Siguiente paso: el Presidente lo firma o lo veta. Si no hace ninguna de las dos cosas en 10 días (sin contar domingos), se convierte en ley, salvo que el Congreso haya levantado la sesión.`);
  } else {
    next = out("The next step can't be determined from the record we have.", "No se puede determinar el siguiente paso con el registro que tenemos.");
  }
  return next;
}

// A short line for lists: the furthest step and its date, or the outcome.
export function trackShort(t, fmt = (d) => d) {
  const s = t.steps;
  const lastDone = [...s].reverse().find((x) => x.date);
  if (t.status === "to_states") return { en: `Passed both chambers ${fmt(lastDone.date)}; to the states`, es: `Aprobado por ambas cámaras el ${fmt(lastDone.date)}; a los estados` };
  if (!lastDone) return { en: "Stage not in the record", es: "Etapa no registrada" };
  const es = stepLabelEs(lastDone.label);
  const base = { en: `${lastDone.label}, ${fmt(lastDone.date)}`, es: `${es}, ${fmt(lastDone.date)}` };
  // A past Congress that ended without a final outcome: say so after the furthest step.
  if (t.endedCongress && !["law", "agreed"].includes(t.status)) return { en: `${base.en} · the ${ord(t.congress)} Congress ended`, es: `${base.es} · terminó el ${t.congress}.º Congreso` };
  return base;
}

const ES = {
  "Introduced": "Presentado", "Reported by committee": "Informado por el comité", "Committee": "Comité",
  "Passed House": "Aprobado por la Cámara", "Failed in House": "Rechazado en la Cámara", "House vote": "Votación en la Cámara",
  "Passed Senate": "Aprobado por el Senado", "Failed in Senate": "Rechazado en el Senado", "Senate vote": "Votación en el Senado",
  "Agreed to in House": "Adoptado por la Cámara", "Agreed to in Senate": "Adoptado por el Senado",
  "To President": "Enviado al Presidente", "Vetoed": "Vetado", "Became law": "Se convirtió en ley", "Becomes law": "Se convierte en ley",
  "Ratified by the states": "Ratificado por los estados", "To the states": "A los estados",
};
export const stepLabelEs = (l) => ES[l] ?? l;
