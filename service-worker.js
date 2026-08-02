/* ==========================================================================
   SERVICE-WORKER.JS — cache-first app shell so the app works with no signal.
   Bump CACHE_NAME whenever you ship a change so clients pick up the update.
   ========================================================================== */

const CACHE_NAME = "er-airway-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/data.js?v=3",
  "./js/calculators.js?v=3",
  "./js/storage.js?v=3",
  "./js/voice.js?v=3",
  "./js/rsi.js?v=3",
  "./js/app.js?v=3",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Allow page to force-activate new service worker
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Cache-first, falling back to network, falling back to cached index.html
// for navigations (so deep app state still loads offline).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => (event.request.mode === "navigate" ? caches.match("./index.html") : undefined));
    })
  );
});
