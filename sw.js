/* Zen Garden offline cache.
   Network first for everything: when online you always get today's files.
   When the network fails, the last copy that loaded is shown instead. */
const CACHE = "zen-garden-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "manifest.webmanifest", "assets/wallpapers/light.jpg", "assets/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== location.origin && !fonts) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // data files carry ?t= / ?v= cache-busters; store them under their bare path
    const key = url.origin === location.origin && url.pathname.includes("/data/") ? url.origin + url.pathname : req;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) cache.put(key, res.clone()).catch(() => {});
      return res;
    } catch (err) {
      const hit = (await cache.match(key)) || (await cache.match(req, { ignoreSearch: true }))
        || (req.mode === "navigate" ? await cache.match("index.html") : null);
      if (hit) return hit;
      throw err;
    }
  })());
});
