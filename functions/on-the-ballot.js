// /on-the-ballot: the page shell with the election year in its preview tags (no database read).
import { serveWithMeta } from "../lib/seoPage.js";
import { ballotMeta } from "../lib/pageMeta.js";

export const onRequest = (context) => serveWithMeta(context, async (url, lang, today) => ballotMeta({ url, lang, today }));
