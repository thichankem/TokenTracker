/*
 * Token Tracker — minimal PWA service worker.
 *
 * Goals:
 *  - Make the dashboard installable on Android (Chrome requires a fetch
 *    handler) and give iOS "Add to Home Screen" an app-like shell.
 *  - Cache only the app shell + immutable static assets. NEVER cache API or
 *    data endpoints (/functions/*, /api/*) — those must always hit the network
 *    so token counts stay fresh and the OAuth callback is never intercepted.
 *
 * The dashboard is data-driven and local-first, so this worker is deliberately
 * conservative: it speeds up first paint and survives brief offline moments,
 * but it never serves stale usage data.
 */

const CACHE_NAME = "tokentracker-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => {/* best-effort: a failed precache must not block activation */})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept API / data / auth endpoints — always network.
  if (url.pathname.startsWith("/functions/") || url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation: network-first, fall back to the cached shell when offline.
  // `cache: "no-store"` bypasses the browser HTTP cache so a freshly deployed
  // index.html (with new hashed chunk URLs) is always fetched, never a stale
  // cached copy that references chunks which no longer exist.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          const copy = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put("/", copy))
            .catch(() => {});
          return response;
        })
        .catch(() => caches.match("/").then((cached) => cached || Response.error())),
    );
    return;
  }

  // Same-origin static assets (hashed bundles, images, fonts): cache-first.
  // Hashed filenames are immutable, so this is safe and avoids re-downloads.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && url.pathname !== "/") {
              const copy = response.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .catch(() => {});
            }
            return response;
          }),
      ),
    );
  }
});