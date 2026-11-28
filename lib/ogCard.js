// Link-preview cards (Open Graph / Twitter images) for record pages: what each card says, where its
// PNG lives, and its alt text. Pure. scripts/og/build.mjs draws the PNGs at deploy time from these
// specs; lib/pageMeta.js points og:image at the same paths and uses the same alt text, so the
// picture and its description can't say different things.
//
// One layout for every record of a kind and every party: name or number, office or title, a
// status line, the party letter badge (D blue, R red, others grey; the letter is always there),
// and the site name. Only members of Congress get a portrait (unitedstates/images, public domain);
// a member without one gets the same card without it. No photos for state or local officials.
// The card text is English (records stay in English as published); the alt text is bilingual.
import { setCurrentLang, getLang, tr } from "../src/lib/lang.js";
import { seatLabel, stateName, billLabel, date, partyName } from "../src/lib/format.js";
import { stateOfficeLabel, stateParty } from "../src/lib/stateOffices.js";
import { billTrack, trackShort } from "./billTrack.js";
import { generalElectionDate } from "./upForElection.js";

export const CARD_W = 1200, CARD_H = 630;
export const PARTY_COLORS = { d: "#1f4e9c", r: "#b42318", other: "#5b6470" };
export const portraitUrl = (bioguide) => `https://unitedstates.github.io/images/congress/450x550/${bioguide}.jpg`;

function inLang(lang, fn) {
  const prev = getLang();
  setCurrentLang(lang === "es" ? "es" : "en");
  try { return fn(); } finally { setCurrentLang(prev); }
}
const both = (fn) => ({ en: inLang("en", fn), es: inLang("es", fn) });
const ord = (n) => `${n}${[11, 12, 13].includes(n % 100) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th")}`;

// Party as a badge: federal ("Democrat") or as a state publishes it ("Democratic-Farmer-Labor").
export function partyBadge(party) {
  if (!party) return null;
  if (party === "Democrat") return { letter: "D", kind: "d", name: "Democrat" };
  if (party === "Republican") return { letter: "R", kind: "r", name: "Republican" };
  const p = stateParty(party);
  return p ? { letter: p.letter, kind: p.kind, name: party } : null;
}

// The file path of a record's card (served from the site root).
export function cardPath(kind, id) {
  const safe = String(id).replace(/[^A-Za-z0-9-]/g, "");
  return `/og/${kind}/${safe}.png`;
}
export const billCardId = (b) => `${b.congress}-${b.bill_type}-${b.number}`;

// Spoken description of a card for og:image:alt, from the same parts the card shows.
function altText(spec) {
  return both(() => {
    const party = spec.party ? tr(`, party ${spec.party.letter} (${spec.party.name})`, `, partido ${spec.party.letter} (${partyName(spec.party.name)})`) : "";
    const lines = [spec.kicker, spec.title, ...spec.lines.map((l) => l.en)].filter(Boolean);
    // No mention of the portrait: whether one exists is known only when the card is drawn.
    return `${tr("Civic Atlas card", "Tarjeta de Civic Atlas")}: ${lines.join(" · ")}${party}`;
  });
}
const finish = (spec) => ({ ...spec, alt: altText(spec) });

// row: member_directory (bioguide_id, name, chamber, state, district, party, start_date, end_date).
export function memberCard(row, { today, portrait = true } = {}) {
  const seat = inLang("en", () => (row.chamber === "senate" ? `U.S. Senator from ${stateName(row.state)}` : seatLabel(row)));
  const when = row.end_date && row.end_date <= today ? `Served until ${inLang("en", () => date(row.end_date))}`
    : row.start_date && row.start_date > today ? `Term begins ${inLang("en", () => date(row.start_date))}` : null;
  return finish({
    kind: "member", path: cardPath("member", row.bioguide_id),
    kicker: "Member of Congress", title: row.name,
    lines: [{ en: seat, strong: true }, when && { en: when }].filter(Boolean),
    party: partyBadge(row.party),
    portrait: portrait ? portraitUrl(row.bioguide_id) : null,
  });
}

// row: bills, with the milestone dates of lib/billprogress.js.
export function billCard(row, { today } = {}) {
  const t = billTrack(row, { today: today ? new Date(`${today}T12:00:00Z`) : new Date() });
  const fmt = (d) => inLang("en", () => date(d));
  const status = trackShort(t, fmt).en;
  const law = row.law_number ? String(row.law_number).replace(/^(?!Public|Private)/, "Public Law ") : null;
  return finish({
    kind: "bill", path: cardPath("bill", billCardId(row)),
    kicker: `${billLabel(row)} · ${ord(Number(row.congress))} Congress`,
    title: row.short_title || row.title || billLabel(row),
    lines: [{ en: status, strong: true }, law && { en: law }].filter(Boolean),
    party: null, portrait: null,
  });
}

// row: committees (committee_id, chamber, name, parent: {name} | null).
export function committeeCard(row) {
  const ch = { house: "House", senate: "Senate", joint: "Joint" }[row.chamber] ?? "";
  const full = (c) => (c.chamber === "joint" || /^(house|senate)\b/i.test(c.name) ? c.name : `${ch} ${c.name}`);
  return finish({
    kind: "committee", path: cardPath("committee", row.committee_id),
    kicker: row.parent?.name ? `${ch} subcommittee` : `${ch} committee`,
    title: full(row),
    lines: row.parent?.name ? [{ en: `Subcommittee of the ${full({ ...row.parent, chamber: row.chamber })}` }] : [],
    party: null, portrait: null,
  });
}

// row: state_people (id, name, state, party, active) with state_roles (type, district, start_date, end_date).
export function statePersonCard(row, { today } = {}) {
  const roles = row.state_roles ?? [];
  const now = roles.find((r) => (!r.start_date || r.start_date <= today) && (!r.end_date || r.end_date > today));
  const office = inLang("en", () => (now && row.active ? stateOfficeLabel(now, row.state) : stateName(row.state)));
  return finish({
    kind: "state", path: cardPath("state", row.id.replace(/^ocd-person\//, "")),
    kicker: "State official", title: row.name,
    lines: [{ en: office, strong: true }],
    party: partyBadge(row.party), portrait: null,
  });
}

export function ballotCard(year) {
  const day = inLang("en", () => date(generalElectionDate(year)));
  return finish({
    kind: "ballot", path: cardPath("ballot", year),
    kicker: "U.S. Congress", title: `On the ballot in ${year}`,
    lines: [{ en: `Seats in Congress on the general-election ballot, ${day}`, strong: true }, { en: "With who holds each seat now" }],
    party: null, portrait: null,
  });
}
