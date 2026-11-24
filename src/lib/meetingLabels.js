import { tr } from "./lang.js";

// "Markup on 23 items" for agenda-style meeting titles, in the site's language.
const TYPE_ES = { hearing: "Audiencia", markup: "Sesión de enmiendas", meeting: "Reunión" };
export const itemsLabel = (type, n) => tr(`${type ?? "Meeting"} on ${n} items`, `${TYPE_ES[(type ?? "meeting").toLowerCase()] ?? type ?? "Reunión"} sobre ${n} asuntos`);
