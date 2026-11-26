// /member/:bioguide: the page shell with the member's name, office and portrait in its preview tags.
import { serveWithMeta, cachedRow } from "../../lib/seoPage.js";
import { matchPage, memberMeta } from "../../lib/pageMeta.js";

export const onRequest = (context) => serveWithMeta(context, async (url, lang, today) => {
  const page = matchPage(url.pathname);
  if (!page) throw new Error("not a member path");
  const row = await cachedRow(context, `member_directory?bioguide_id=eq.${page.id}&select=bioguide_id,name,chamber,state,district,party,start_date,end_date`);
  return row && memberMeta(row, { url, lang, today });
});
