// Title, description, canonical URL and link-preview image for pages whose content is a record (a
// member, a bill, a committee, a state official) or the On the ballot page. Pure functions: the
// Pages Functions in functions/member, functions/bill, ... fetch one small row and inject the result
// into index.html, so search engines and link previews see the record's name instead of the shell.
// Wording reuses the site's own helpers and stays factual: name, office, party letter, dates.
import { setCurrentLang, getLang, tr } from "../src/lib/lang.js";
import { seatLabel, stateName, billLabel, date } from "../src/lib/format.js";
import { stateOfficeLabel, stateParty } from "../src/lib/stateOffices.js";
import { generalElectionDate, nextElectionYear } from "./upForElection.js";

export const SITE = "Civic Atlas";
export const SITE_CARD = "/og/site.png";
const BILL_TYPES = new Set(["hr", "s", "hres", "sres", "hjres", "sjres", "hconres", "sconres"]);

// Which record a path names, or null. Only these paths get tags; everything else is untouched.
export function matchPage(pathname) {
  let m;
  if ((m = pathname.match(/^\/member\/([A-Z]\d{6})\/?$/))) return { kind: "member", id: m[1] };
  if ((m = pathname.match(/^\/bill\/(\d{2,3})\/([a-z]+)\/(\d{1,5})\/?$/)) && BILL_TYPES.has(m[2]))
    return { kind: "bill", congress: Number(m[1]), type: m[2], number: Number(m[3]) };
  if ((m = pathname.match(/^\/committee\/([A-Za-z0-9]{2,12})\/?$/))) return { kind: "committee", id: m[1].toUpperCase() };
  if ((m = pathname.match(/^\/state\/person\/([0-9a-f-]{36})\/?$/))) return { kind: "statePerson", id: m[1] };
  if (/^\/on-the-ballot\/?$/.test(pathname)) return { kind: "ballot" };
  return null;
}

// The site's helpers read one module-wide language. Switch it only for this synchronous call (no
// await inside), so concurrent requests in the same isolate can't see each other's language.
function inLang(lang, fn) {
  const prev = getLang();
  setCurrentLang(lang === "es" ? "es" : "en");
  try { return fn(); } finally { setCurrentLang(prev); }
}

const clip = (s, n) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…`;
};
const letter = (party) => stateParty(party === "Democrat" ? "Democratic" : party)?.letter ?? "";

function base(url, lang, path) {
  // The canonical URL keeps only ?lang=es (a real Spanish version); other parameters are views of the same page.
  const canonical = new URL(path, url.origin);
  if (lang === "es") canonical.searchParams.set("lang", "es");
  return { canonical: canonical.toString(), image: new URL(SITE_CARD, url.origin).toString(), imageAlt: SITE, card: "summary_large_image", locale: lang === "es" ? "es_US" : "en_US" };
}

// row: member_directory (name, chamber, state, district, party, start_date, end_date).
export function memberMeta(row, { url, lang = "en", today }) {
  return inLang(lang, () => {
    const seat = row.chamber === "senate"
      ? tr(`U.S. Senator from ${stateName(row.state)}`, `Senador(a) de EE. UU. por ${stateName(row.state)}`)
      : seatLabel(row);
    const p = letter(row.party);
    const when = row.end_date && row.end_date <= today ? tr(`, until ${date(row.end_date)}`, `, hasta el ${date(row.end_date)}`)
      : row.start_date && row.start_date > today ? tr(`, from ${date(row.start_date)}`, `, desde el ${date(row.start_date)}`) : "";
    return {
      ...base(url, lang, `/member/${row.bioguide_id}`),
      title: `${row.name} · ${SITE}`,
      ogTitle: row.name,
      description: `${row.name}, ${seat}${p ? ` (${p})` : ""}${when}. ${tr("Votes, bills, committees and campaign money from official records.", "Votos, proyectos de ley, comités y dinero de campaña según registros oficiales.")}`,
      type: "profile",
      // Official portrait, public domain (unitedstates/images). Portrait-shaped, so the small card.
      image: `https://unitedstates.github.io/images/congress/450x550/${row.bioguide_id}.jpg`,
      imageAlt: tr(`Official portrait of ${row.name}`, `Retrato oficial de ${row.name}`),
      card: "summary",
    };
  });
}

// row: bills (congress, bill_type, number, title, short_title, introduced_date, latest_action_date, latest_action_text, law_number).
export function billMeta(row, { url, lang = "en" }) {
  return inLang(lang, () => {
    const label = billLabel(row);
    const name = clip(row.short_title || row.title, 110);
    const parts = [];
    // law_number is stored as printed ("Public Law 119-21"); add the label only to a bare number.
    if (row.law_number) {
      const n = String(row.law_number).replace(/^(Public|Private) Law\s*/i, "");
      const kind = /^Private/i.test(row.law_number) ? ["Private Law", "Ley Privada"] : ["Public Law", "Ley Pública"];
      parts.push(tr(`${kind[0]} ${n}`, `${kind[1]} ${n}`));
    }
    if (row.introduced_date) parts.push(tr(`Introduced ${date(row.introduced_date)}`, `Presentado el ${date(row.introduced_date)}`));
    if (row.latest_action_text) parts.push(`${tr("latest action", "última acción")}${row.latest_action_date ? ` (${date(row.latest_action_date)})` : ""}: ${row.latest_action_text}`);
    return {
      ...base(url, lang, `/bill/${row.congress}/${row.bill_type}/${row.number}`),
      title: `${label}: ${name} · ${SITE}`,
      ogTitle: `${label}: ${name}`,
      description: clip(parts.join(" · ") || `${label}, ${row.congress}th Congress`, 300),
      type: "article",
    };
  });
}

// row: committees (committee_id, chamber, name, parent: {name} | null).
export function committeeMeta(row, { url, lang = "en" }) {
  return inLang(lang, () => {
    const chamber = { house: tr("House", "Cámara:"), senate: tr("Senate", "Senado:"), joint: tr("Joint", "Conjunto:") }[row.chamber] ?? "";
    const full = (c) => (c.chamber === "joint" || /^(house|senate)\b/i.test(c.name) ? c.name : `${chamber} ${c.name}`);
    const name = full(row);
    const parent = row.parent?.name ? full({ ...row.parent, chamber: row.chamber }) : null;
    return {
      ...base(url, lang, `/committee/${row.committee_id}`),
      title: `${name} · ${SITE}`,
      ogTitle: name,
      description: `${parent ? tr(`A subcommittee of the ${parent}. `, `Subcomité de: ${parent}. `) : ""}${tr("Members, bills referred and meetings, from official House and Senate records.", "Miembros, proyectos de ley remitidos y reuniones, según registros oficiales de la Cámara y el Senado.")}`,
      type: "website",
    };
  });
}

// row: state_people (id, name, state, party, active) with state_roles (type, district, start_date, end_date).
export function statePersonMeta(row, { url, lang = "en", today }) {
  return inLang(lang, () => {
    const roles = row.state_roles ?? [];
    const now = roles.find((r) => (!r.start_date || r.start_date <= today) && (!r.end_date || r.end_date > today));
    const p = stateParty(row.party)?.letter;
    const office = now && row.active ? `, ${stateOfficeLabel(now, row.state)}` : `, ${stateName(row.state)}`;
    return {
      ...base(url, lang, `/state/person/${row.id.replace(/^ocd-person\//, "")}`),
      title: `${row.name} · ${SITE}`,
      ogTitle: row.name,
      description: `${row.name}${office}${p ? ` (${p})` : ""}. ${tr("Office, contact details and past roles from official state sources.", "Cargo, datos de contacto y cargos anteriores según fuentes estatales oficiales.")}`,
      type: "profile",
    };
  });
}

// No database read: the year comes from the URL or the calendar, as on the page itself.
export function ballotMeta({ url, lang = "en", today }) {
  return inLang(lang, () => {
    const asked = Number(url.searchParams.get("year"));
    const year = asked >= 2024 && asked <= 2100 && asked % 2 === 0 ? asked : nextElectionYear(today);
    const meta = base(url, lang, "/on-the-ballot");
    if (year === asked) { const c = new URL(meta.canonical); c.searchParams.set("year", String(year)); meta.canonical = c.toString(); }
    return {
      ...meta,
      title: `${tr(`On the ballot in ${year}`, `En la boleta en ${year}`)} · ${SITE}`,
      ogTitle: tr(`On the ballot in ${year}`, `En la boleta en ${year}`),
      description: tr(`Seats in Congress on the ballot in the ${year} general election (${date(generalElectionDate(year))}), with who holds each one now, from term end dates in the official member list.`,
        `Escaños del Congreso en la boleta en la elección general de ${year} (${date(generalElectionDate(year))}), con quién ocupa cada uno ahora, según las fechas de fin de período de la lista oficial de miembros.`),
      type: "website",
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Injection into index.html. Handlers for HTMLRewriter, kept here (not in the Function) so tests
// can drive them with stand-in elements.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// The tags appended before </head>, after the shell's generic ones are removed.
export function headTags(meta) {
  const tags = [
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(meta.canonical)}" />`,
    `<meta property="og:title" content="${esc(meta.ogTitle)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:type" content="${esc(meta.type)}" />`,
    `<meta property="og:url" content="${esc(meta.canonical)}" />`,
    `<meta property="og:locale" content="${esc(meta.locale)}" />`,
    `<meta property="og:image" content="${esc(meta.image)}" />`,
    `<meta property="og:image:alt" content="${esc(meta.imageAlt)}" />`,
    `<meta name="twitter:card" content="${esc(meta.card)}" />`,
    `<meta name="twitter:title" content="${esc(meta.ogTitle)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(meta.image)}" />`,
  ];
  return `\n    ${tags.join("\n    ")}\n  `;
}

// The shell's own page-level tags (all but og:site_name), which the record's tags replace.
export const SHELL_TAGS = 'meta[name="description"], meta[property^="og:"]:not([property="og:site_name"]), meta[name^="twitter:"], link[rel="canonical"]';

// [selector, handler] pairs for HTMLRewriter.on().
export function rewriteHandlers(meta) {
  return [
    ["title", { element(el) { el.setInnerContent(meta.title); } }],
    [SHELL_TAGS, { element(el) { el.remove(); } }],
    ["html", { element(el) { el.setAttribute("lang", meta.locale === "es_US" ? "es" : "en"); } }],
    ["head", { element(el) { el.append(headTags(meta), { html: true }); } }],
  ];
}
