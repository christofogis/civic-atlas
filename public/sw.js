// Civic Atlas service worker. Deliberately small: it makes the site installable and shows an
// offline page, but never serves stale records. Pages and data always come from the network.
// Only the hashed build files (/assets/*), which never change once published, are cached.
const CACHE = "civic-atlas-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // database, Google, video: straight to the network

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) {
        await c.put(req, res.clone());
        // Keep the cache small: old builds' files are dropped, oldest first.
        const keys = (await c.keys()).filter((k) => new URL(k.url).pathname.startsWith("/assets/"));
        for (const k of keys.slice(0, Math.max(0, keys.length - 120))) await c.delete(k);
      }
      return res;
    }));
  }
});
