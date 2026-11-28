// /constitution: the page shell with the page's own title and description in its preview tags (no database read).
import { serveWithMeta } from "../lib/seoPage.js";
import { constitutionMeta } from "../lib/pageMeta.js";

export const onRequest = (context) => serveWithMeta(context, async (url, lang) => constitutionMeta({ url, lang }));
