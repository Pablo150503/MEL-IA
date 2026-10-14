// MEL-IA service worker
//
// The app always runs the version stored in the cache (cache-first). When a
// new version is published (a commit to main that Vercel deploys), js/pwa.js
// detects it as soon as the app opens and shows the "Update available" popup.
// Only when the user accepts (or 15 minutes later) is the new version loaded:
//  - if this file (sw.js) changed, the new worker is already installed and
//    waiting with the new files: pwa.js activates it ("SKIP_WAITING");
//  - otherwise this worker downloads the new version into its own cache
//    ("REFRESH") and the page reloads.
// That is why install does NOT call skipWaiting().
const SW_VERSION = "v9";
const APP_CACHE = `melia-app-${SW_VERSION}`;
// CDN files have the library version in their URL (they never change), so
// they are kept across app versions instead of being downloaded again.
const CDN_CACHE = "melia-cdn";

// App files. Anything else the app requests later (same origin) is also
// stored and refreshed together with these when updating.
const PRECACHE_URLS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  "js/script.js",
  "js/rest.js",
  "js/demo.js",
  "js/exportar.js",
  "js/pwa.js",
  "assets/logo.png",
  "assets/pablo.glb",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-512-maskable.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/favicon-32.png",
  "assets/icons/favicon.png",
  "assets/casos/caso-1a.jpg",
  "assets/casos/caso-1b.jpg",
  "assets/casos/caso-2.jpg",
  "assets/casos/caso-3.jpg",
  "assets/casos/caso-4.jpg",
  "assets/casos/caso-5.jpg",
  "assets/animaciones/analisis-piel.json",
  "assets/animaciones/analisis-ia.json",
];

// External libraries used by index.html (plus the Font Awesome font its CSS
// loads), so the installed app also works offline.
const CDN_PRECACHE_URLS = [
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2",
  "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js",
  "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie_light.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
];

const CDN_HOSTS = ["cdnjs.cloudflare.com", "cdn.jsdelivr.net"];

function absolute(url) {
  return new URL(url, self.registration.scope).href;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const appCache = await caches.open(APP_CACHE);
      const cdnCache = await caches.open(CDN_CACHE);
      await Promise.all([
        ...PRECACHE_URLS.map(async (url) => {
          try {
            // "no-cache": revalidate with the server, never an old HTTP-cache copy
            const response = await fetch(url, { cache: "no-cache" });
            if (response && response.ok) await appCache.put(absolute(url), response);
          } catch (err) {
            // A missing or unreachable file never makes the install fail.
          }
        }),
        ...CDN_PRECACHE_URLS.map(async (url) => {
          try {
            if (await cdnCache.match(url)) return;
            const response = await fetch(url, { mode: "cors" });
            if (response && response.ok) await cdnCache.put(url, response);
          } catch (err) {
            // Same as above.
          }
        }),
      ]);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [APP_CACHE, CDN_CACHE];
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !keep.includes(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

// Downloads the published version of every app file this worker has stored.
// Everything is downloaded first: if anything fails (e.g. no connection) the
// cache is not touched and the app keeps working with the version it had.
async function refreshAppCache() {
  const cache = await caches.open(APP_CACHE);
  const stored = (await cache.keys()).map((request) => request.url);
  const urls = [...new Set([...PRECACHE_URLS.map(absolute), ...stored])];

  const results = await Promise.all(
    urls.map(async (url) => [url, await fetch(url, { cache: "no-cache" })])
  );
  const failed = results.find(([, response]) => !response.ok && response.status !== 404);
  if (failed) throw new Error(`${failed[0]} ${failed[1].status}`);

  for (const [url, response] of results) {
    if (response.ok) await cache.put(url, response);
    else await cache.delete(url); // 404: the file no longer exists in the new version
  }
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data === "REFRESH") {
    const reply = (ok) => event.ports[0] && event.ports[0].postMessage({ ok });
    event.waitUntil(refreshAppCache().then(() => reply(true), () => reply(false)));
  }
});

// App files: the stored version first; the network only for what is not stored.
async function appFirst(request) {
  const cache = await caches.open(APP_CACHE);
  const navigation = request.mode === "navigate";
  const cached =
    (await cache.match(request, { ignoreSearch: navigation })) ||
    (navigation ? await cache.match(absolute("./")) : undefined);
  if (cached) return cached;

  const response = await fetch(request, { cache: "no-cache" });
  if (response && response.ok && !navigation) cache.put(request, response.clone());
  return response;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept API calls: always go straight to the network.
  if (url.pathname.startsWith("/api/")) return;

  // Version checks from pwa.js must see what is published, not the cache.
  if (request.cache === "no-store") return;

  // External libraries: cache-first (their URLs never change).
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, CDN_CACHE));
    return;
  }

  // The app itself (pages, scripts, styles, images...): the installed version.
  if (url.origin === self.location.origin) {
    event.respondWith(appFirst(request));
  }

  // Anything else (other third-party origins): just let the network handle it.
});
