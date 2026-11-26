// /bill/:congress/:type/:number: the page shell with the bill's number, title, introduction date
// and latest action in its preview tags.
import { serveWithMeta, cachedRow } from "../../../../lib/seoPage.js";
import { matchPage, billMeta } from "../../../../lib/pageMeta.js";

export const onRequest = (context) => serveWithMeta(context, async (url, lang) => {
  const page = matchPage(url.pathname);
  if (!page) throw new Error("not a bill path");
  const row = await cachedRow(context, `bills?congress=eq.${page.congress}&bill_type=eq.${page.type}&number=eq.${page.number}` +
    "&select=congress,bill_type,number,title,short_title,introduced_date,latest_action_date,latest_action_text,law_number");
  return row && billMeta(row, { url, lang });
});
