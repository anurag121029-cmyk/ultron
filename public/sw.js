/* ULTRON service worker — app shell only, never API or user data.
   - Caches the app shell on install so the installed app opens offline.
   - Network-first for navigation and for /api/* (API responses are never cached).
   - Cache-first only for same-origin static assets (icons, manifest, JS/CSS).
*/
const CACHE_NAME = "ultron-shell-v1";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache or serve API calls from cache — chat/image/vision always need the network.
  if (url.pathname.startsWith("/api/")) return;
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // Network-first for pages, fall back to the cached shell when offline.
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put("/", copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("/"))
    );
    return;
  }

  // Same-origin static assets: cache-first, then network (and cache the fresh copy).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
