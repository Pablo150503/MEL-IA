// MEL-IA service worker
// Bump this on every deploy that changes cached assets.
const SW_VERSION = "v6";
// Same-origin requests wait this long for the network before using the cache.
const NETWORK_TIMEOUT_MS = 4000;
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
  "exportar.js",
  "pwa.js",
  "logo.png",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "icons/favicon.png",
  "img/casos/caso-1a.jpg",
  "img/casos/caso-1b.jpg",
  "img/casos/caso-2.jpg",
  "img/casos/caso-3.jpg",
  "img/casos/caso-4.jpg",
  "img/casos/caso-5.jpg",
  "animaciones/analisis-piel.json",
  "animaciones/analisis-ia.json",
  "pablo.glb",
];

// External libraries used by index.html (plus the Font Awesome font its CSS
// loads). Precached so the installed app works offline from the first launch,
// not only after a second visit once the page is controlled by this worker.
const CDN_PRECACHE_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2",
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js",
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie_light.min.js",
];

const CDN_HOSTS = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      const cdnCache = await caches.open(RUNTIME_CDN);
      await Promise.all([
        ...PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "no-cache" });
            if (response && response.ok) {
              await cache.put(url, response);
            }
          } catch (err) {
            // Ignore missing/unreachable files so install never fails
            // because of one optional asset.
          }
        }),
        ...CDN_PRECACHE_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { mode: "cors" });
            if (response && response.ok) {
              await cdnCache.put(url, response);
            }
          } catch (err) {
            // Same as above: never fail install because a CDN is unreachable.
          }
        }),
      ]);
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
    // Revalidate the page with the server too, so an update is never served
    // from the browser's HTTP cache.
    const response = await fetch(request, { cache: "no-cache" });
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

// Network-first so a new deployment is used as soon as the page reloads (the
// update popup in pwa.js relies on this). If the network is slow, the cached
// copy is used after NETWORK_TIMEOUT_MS; offline, any cache (runtime or the
// precached app shell) is used.
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  // "no-cache": always revalidate with the server (cheap 304 if unchanged).
  // Otherwise the browser's HTTP cache could hand back an old file after an
  // update, and the page would keep running the previous version.
  const network = fetch(request, { cache: "no-cache" }).then((response) => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  });
  network.catch(() => {});
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS, "timeout"));

  try {
    const first = await Promise.race([network, timeout]);
    if (first !== "timeout") return first;
    return (await caches.match(request)) || (await network);
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
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

  // Version checks from pwa.js must see what is deployed, not the cache.
  if (request.cache === "no-store") {
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

  // Same-origin static assets: network-first with cache fallback.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, RUNTIME_SAME_ORIGIN));
    return;
  }

  // Anything else (other third-party origins): just let the network handle it.
});
