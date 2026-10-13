// MEL-IA service worker
// Bump this on every deploy that changes cached assets.
const SW_VERSION = "v1";
const PRECACHE = `melia-precache-${SW_VERSION}`;
const RUNTIME_SAME_ORIGIN = `melia-runtime-${SW_VERSION}`;
const RUNTIME_CDN = `melia-cdn-${SW_VERSION}`;
const CURRENT_CACHES = [PRECACHE, RUNTIME_SAME_ORIGIN, RUNTIME_CDN];

// App shell. Listed files that don't exist (e.g. demo.js may or may not be
// present) are skipped individually so one missing file never aborts install.
const PRECACHE_URLS = [
  "./",
  "index.html",
  "styles.css",
  "script.js",
  "rest.js",
  "demo.js",
  "pwa.js",
  "logo.png",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/favicon.png",
];

const CDN_HOSTS = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "no-cache" });
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch (err) {
            // Ignore missing/unreachable files so install never fails
            // because of one optional asset.
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isCdnRequest(url) {
  return CDN_HOSTS.includes(url.hostname);
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_SAME_ORIGIN);
      cache.put("index.html", response.clone());
    }
    return response;
  } catch (err) {
    const cache = await caches.open(RUNTIME_SAME_ORIGIN);
    const cached = await cache.match("index.html");
    if (cached) return cached;
    const precache = await caches.open(PRECACHE);
    const precached = await precache.match("index.html");
    if (precached) return precached;
    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await networkPromise) || Promise.reject("offline");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept API calls: always go straight to the network.
  if (isApiRequest(url)) {
    return;
  }

  // Navigations (HTML documents): network-first, offline fallback to index.
  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Cross-origin CDN assets (three.js, font-awesome, fonts): cache-first.
  if (isCdnRequest(url)) {
    event.respondWith(cacheFirst(request, RUNTIME_CDN));
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_SAME_ORIGIN));
    return;
  }

  // Anything else (other third-party origins): just let the network handle it.
});
