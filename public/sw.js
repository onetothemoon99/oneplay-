/* ---------------------------------------------------------
   ONEPLAY — offline support for the PSX emulator

   Scope is the whole origin (this file lives at the root), but the
   only assets it actively caches are the ones the PSX stage cannot
   run without offline: the libretro core, and whatever hashed
   `/_next/static/` chunks and pages a player's browser has already
   requested while online. Everything else (auth, API routes, the
   Google Drive import) is left to the network — caching those would
   risk serving stale data, and they are useless offline anyway.

   Bump CACHE_VERSION when the set of cached assets changes; `activate`
   drops every cache under the old name.
--------------------------------------------------------- */

const CACHE_VERSION = 'oneplay-psx-v1';
const CORE_ASSETS = ['/cores/pcsx_rearmed_libretro.js', '/cores/pcsx_rearmed_libretro.wasm'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {}) // offline on first install: nothing to precache yet, fetch handler will fill the cache in later
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

/**
 * `PsxStage` HEAD-probes the core before booting (see `components/PsxStage.tsx`)
 * to fail fast with a clear error instead of RetroArch's own. `Cache.match`
 * only matches GET entries, and the core was only ever stored under a GET
 * request, so the probe needs its own lookup rather than `cacheFirst`.
 */
async function coreHead(request) {
  try {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(new Request(request.url));
    if (cached) return new Response(null, { status: cached.status || 200, headers: cached.headers });
  } catch { /* fall through to the network */ }
  return fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/cores/')) {
    if (request.method === 'HEAD') event.respondWith(coreHead(request));
    else if (request.method === 'GET') event.respondWith(cacheFirst(request));
    return;
  }

  if (request.method !== 'GET') return;

  // Hashed build output never changes under a given URL, so a cache hit is
  // always correct.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Pages: prefer the network, so a connected player always sees the
  // current shelf/build, but fall back to whatever was cached from the
  // last successful visit when there is none.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  }
});
