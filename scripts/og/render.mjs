// Draw one link-preview card (1200x630 PNG) from a spec made by lib/ogCard.js: satori lays the
// card out as SVG with the site's own font (Public Sans, from node_modules), resvg rasterizes it.
// Runs at build time only (scripts/og/build.mjs), never in a Pages Function: both are far over the
// free plan's 10 ms CPU per request.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { CARD_W, CARD_H, PARTY_COLORS } from "../../lib/ogCard.js";

const require = createRequire(import.meta.url);
const FONT_DIR = require.resolve("@fontsource/public-sans/package.json").replace(/package\.json$/, "files/");
const font = (subset, weight) => ({ name: "Public Sans", weight, style: "normal", data: readFileSync(`${FONT_DIR}public-sans-${subset}-${weight}-normal.woff`) });
const FONTS = [font("latin", 400), font("latin", 700), font("latin-ext", 400), font("latin-ext", 700)];

const INK = "#18212b", MUTED = "#55616d", ACCENT = "#157a4c", RULE = "#dde3e9";

// Minimal element helper for satori (it takes React-like objects; no JSX in build scripts).
const h = (type, style, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat().filter((c) => c != null && c !== false) } });
const img = (src, style) => ({ type: "img", props: { src, style } });

const clip = (s, n) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…`;
};
// Long names and bill titles get a smaller size so up to three lines fit.
const titleSize = (t, hasPortrait) => {
  const n = t.length * (hasPortrait ? 1.35 : 1);
  return n <= 28 ? 68 : n <= 60 ? 58 : n <= 100 ? 48 : 42;
};

function badge(party, size) {
  return h("div", { backgroundColor: PARTY_COLORS[party.kind] ?? PARTY_COLORS.other, color: "#ffffff", fontSize: size, fontWeight: 700,
    padding: `${Math.round(size * 0.08)}px ${Math.round(size * 0.38)}px`, borderRadius: Math.round(size * 0.2), lineHeight: 1.2 }, party.letter);
}

export function cardElement(spec, portraitDataUri) {
  const frame = spec.party ? PARTY_COLORS[spec.party.kind] ?? PARTY_COLORS.other : PARTY_COLORS.other;
  const title = clip(spec.title, 140);
  const photo = portraitDataUri && h("div", { position: "relative", width: 300, height: 367, flexShrink: 0, border: `8px solid ${frame}`, borderRadius: 14, overflow: "hidden", backgroundColor: "#ffffff" },
    img(portraitDataUri, { width: "100%", height: "100%", objectFit: "cover" }),
    spec.party && h("div", { position: "absolute", left: 0, bottom: 0, backgroundColor: frame, color: "#ffffff", fontSize: 36, fontWeight: 700, padding: "0px 14px 2px", borderTopRightRadius: 10, lineHeight: 1.2 }, spec.party.letter));
  const text = h("div", { flexDirection: "column", flexGrow: 1, flexShrink: 1, marginLeft: photo ? 56 : 0, minWidth: 0 },
    h("div", { fontSize: 30, color: MUTED }, clip(spec.kicker, 60)),
    h("div", { fontSize: titleSize(title, Boolean(photo)), fontWeight: 700, color: INK, lineHeight: 1.12, marginTop: 12, lineClamp: 3 }, title),
    spec.party && h("div", { alignItems: "center", marginTop: 24 }, badge(spec.party, 30), h("div", { fontSize: 30, color: MUTED, marginLeft: 14 }, clip(spec.party.name, 40))),
    ...spec.lines.map((l, i) => h("div", { fontSize: 32, color: l.strong ? INK : MUTED, fontWeight: l.strong ? 700 : 400, marginTop: i ? 10 : 24, lineHeight: 1.25 }, clip(l.en, 110))));
  return h("div", { width: CARD_W, height: CARD_H, flexDirection: "column", backgroundColor: "#ffffff", fontFamily: "Public Sans" },
    h("div", { height: 14, backgroundColor: ACCENT }),
    h("div", { flexGrow: 1, padding: "52px 72px 0px", alignItems: "flex-start", overflow: "hidden" }, photo, text),
    h("div", { margin: "0px 72px", padding: "20px 0px 30px", borderTop: `2px solid ${RULE}`, justifyContent: "space-between", alignItems: "center" },
      h("div", { fontSize: 36, fontWeight: 700, color: ACCENT }, "Civic Atlas"),
      h("div", { fontSize: 26, color: MUTED }, "From official records")));
}

// spec: from lib/ogCard.js. portrait: JPEG bytes or null. Returns PNG bytes.
export async function renderCard(spec, portrait = null) {
  const uri = portrait ? `data:image/jpeg;base64,${Buffer.from(portrait).toString("base64")}` : null;
  const svg = await satori(cardElement(spec, uri), { width: CARD_W, height: CARD_H, fonts: FONTS });
  return new Resvg(svg, { fitTo: { mode: "width", value: CARD_W }, font: { loadSystemFonts: false } }).render().asPng();
}
