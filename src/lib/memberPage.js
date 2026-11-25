import { db } from "./db.js";

// The top of a member page in one request (database function member_page). Started as early as
// possible: main.jsx calls it on a member URL before the page's own code has downloaded, and the
// page picks up the same request. Kept briefly so going back to a member doesn't refetch.
const cache = new Map();
export function memberPage(id) {
  if (!cache.has(id)) {
    const p = db.rpc("member_page", { bioguide: id }).then(({ data, error }) => { if (error) throw error; return data; });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
    setTimeout(() => cache.delete(id), 5 * 60 * 1000);
  }
  return cache.get(id);
}
