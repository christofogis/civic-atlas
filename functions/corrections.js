// /corrections: the page shell with the corrections log's title and description in its preview tags
// (no database read: the log is built from data/corrections/ in the repo).
import { serveWithMeta } from "../lib/seoPage.js";
import { correctionsMeta } from "../lib/pageMeta.js";
import { buildCorrections } from "../lib/corrections.js";
import log from "../data/corrections/log.json";
import leadership from "../data/corrections/leadership.json";

const entries = buildCorrections(log, leadership);
export const onRequest = (context) => serveWithMeta(context, async (url, lang) => correctionsMeta({ url, lang, entries }));
