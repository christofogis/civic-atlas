// /committee/:id: the page shell with the committee's name in its preview tags.
import { serveWithMeta, cachedRow } from "../../lib/seoPage.js";
import { matchPage, committeeMeta } from "../../lib/pageMeta.js";

export const onRequest = (context) => serveWithMeta(context, async (url, lang) => {
  const page = matchPage(url.pathname);
  if (!page) throw new Error("not a committee path");
  const row = await cachedRow(context, `committees?committee_id=eq.${page.id}&select=committee_id,chamber,name,parent:parent_id(name)`);
  return row && committeeMeta(row, { url, lang });
});
