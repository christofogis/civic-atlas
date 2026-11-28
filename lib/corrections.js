// The public corrections log (/corrections and /data/corrections.json), from two files in the repo:
// data/corrections/log.json (written by hand, one entry per fix that changed what the site showed)
// and data/corrections/leadership.json (our sourced corrections to congress-legislators, which the
// members job applies; each group of entries there becomes one log entry here, automatically).
// Pure: the page imports both files at build time and vite.config.js publishes the result.

export const REPO = "https://github.com/christofogis/civic-atlas";
export const ISSUES_URL = `${REPO}/issues/new`;
export const commitUrl = (sha) => `${REPO}/commit/${sha}`;
export const CAUSES = ["code", "upstream", "source"];
const LEGISLATORS = "https://github.com/unitedstates/congress-legislators";

const day = (d, lang) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "es" ? "es-US" : "en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

// One log entry from the leadership.json entries that share a group.
export function leadershipEntry(group, items) {
  const first = items[0];
  const both = (fn) => ({ en: fn("en"), es: fn("es") });
  const join = (parts, lang) => parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} ${lang === "es" ? "y" : "and"} ${parts.at(-1)}`;
  const shownPart = (c, lang) => c.action === "end"
    ? (lang === "es" ? `${c.name} seguía apareciendo como ${c.title}` : `${c.name} was still shown as ${c.title}`)
    : (lang === "es" ? `${c.name} no aparecía como ${c.title}` : `${c.name} was not shown as ${c.title}`);
  const nowPart = (c, lang) => c.action === "end"
    ? (lang === "es" ? `${c.name} aparece en el cargo hasta el ${day(c.end_date, lang)}` : `${c.name} is shown in the post until ${day(c.end_date, lang)}`)
    : (lang === "es" ? `${c.name} aparece desde el ${day(c.start_date, lang)}` : `${c.name} is shown from ${day(c.start_date, lang)}`);
  const retired = items.every((c) => c.retired) ? items.map((c) => c.retired).sort().at(-1) : null;
  const reported = items.find((c) => c.reported_upstream)?.reported_upstream ?? null;
  return {
    id: group,
    date: first.fixed_on,
    area: "members",
    cause: "upstream",
    shown: both((l) => `${join(items.map((c) => shownPart(c, l)), l)}${l === "es"
      ? ", porque el conjunto de datos congress-legislators que lee el sitio aún no tenía el cambio."
      : ", because the congress-legislators dataset the site reads did not yet have the change."}`),
    now: both((l) => `${join(items.map((c) => nowPart(c, l)), l)}${l === "es"
      ? ", como en la página oficial, con una nota de que es una corrección nuestra."
      : ", as on the official page, with a note that this is our correction."}`),
    commits: [...new Set(items.map((c) => c.commit).filter(Boolean))],
    sources: [...new Set(items.map((c) => c.source))].map((url) => ({ label: new URL(url).hostname.replace(/^www\./, "") + new URL(url).pathname.replace(/\/$/, ""), url })),
    upstream: { dataset: LEGISLATORS, reported, retired },
    page: "/leadership",
  };
}

// All entries, newest first (ties keep the file's order, leadership entries after the hand-written ones).
export function buildCorrections(log, leadership) {
  const groups = new Map();
  for (const c of leadership?.corrections ?? []) {
    const key = c.group ?? `${c.bioguide_id}-${c.title}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const auto = [...groups].filter(([, items]) => items[0].fixed_on).map(([g, items]) => leadershipEntry(g, items));
  const all = [...(log?.entries ?? []), ...auto];
  return all.map((e, i) => ({ e, i })).sort((a, b) => (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : a.i - b.i)).map(({ e }) => e);
}

// Problems with an entry, for the test (an empty list means it's fine).
export function checkEntry(e) {
  const bad = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? "")) bad.push("date");
  for (const k of ["shown", "now"]) if (!e[k]?.en || !e[k]?.es) bad.push(`${k} needs en and es`);
  if (!CAUSES.includes(e.cause)) bad.push("cause");
  if (!e.commits?.length || e.commits.some((s) => !/^[0-9a-f]{7,40}$/.test(s))) bad.push("commits");
  if (!e.sources?.length || e.sources.some((s) => !/^https:\/\//.test(s.url) || !s.label)) bad.push("sources");
  if (e.page && !e.page.startsWith("/")) bad.push("page");
  return bad;
}
