// /state/person/:id: the page shell with the state official's name and office in its preview tags.
import { serveWithMeta, cachedRow } from "../../../lib/seoPage.js";
import { matchPage, statePersonMeta } from "../../../lib/pageMeta.js";

export const onRequest = (context) => serveWithMeta(context, async (url, lang, today) => {
  const page = matchPage(url.pathname);
  if (!page) throw new Error("not a state official path");
  const row = await cachedRow(context, `state_people?id=eq.ocd-person/${page.id}&select=id,name,state,party,active,state_roles(type,district,start_date,end_date)`);
  return row && statePersonMeta(row, { url, lang, today });
});
