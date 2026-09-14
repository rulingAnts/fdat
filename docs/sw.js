/* FDAT PWA Service Worker */
/* Bump SW_VERSION whenever a file in CORE_FILES changes; that triggers the in-app "Update available" toast. */
const SW_VERSION = 'v3';
const PRECACHE = `fdat-precache-${SW_VERSION}`;
const RUNTIME = `fdat-runtime-${SW_VERSION}`;

// Core files to cache for offline
const CORE_FILES = [
  './',
  './index.html',
  './app.js',
  './textchart/textchart-to-html.xsl',
  './manifest.webmanifest',
  './assets/icon-16.png',
  './assets/icon-32.png',
  './assets/icon-48.png',
  './assets/icon-64.png',
  './assets/icon-128.png',
  './assets/icon-192.png',
  './assets/icon-192-maskable.png',
  './assets/icon-256.png',
  './assets/icon-512.png',
  './assets/icon-512-maskable.png'
];

// Text assets are fetched network-first so a deploy is picked up on the next load
// (falling back to cache offline); images are served cache-first.
const NETWORK_FIRST = /\.(?:html|js|xsl|xslt|webmanifest|json)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(CORE_FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => {
      if (k !== PRECACHE && k !== RUNTIME && k.startsWith('fdat-')) {
        return caches.delete(k);
      }
      return Promise.resolve();
    }))).then(() => self.clients.claim()).then(async () => {
      // Notify any open pages that offline core is ready (first-run UX)
      try {
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.forEach(c => c.postMessage({ type: 'PRECACHE_DONE' }));
      } catch (_) {}
    })
  );
});

// Allow page to request immediate activation
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function fromNetwork(request) {
  return fetch(request).then((response) => {
    // Only cache successful, same-origin responses (never 404s or opaque errors)
    if (response && response.ok && response.type === 'basic') {
      const copy = response.clone();
      caches.open(RUNTIME).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return response;
  });
}

function fromCache(request) {
  // ignoreSearch lets a query-string variant fall back to the precached file
  return caches.match(request, { ignoreSearch: true }).then((cached) => cached || Promise.reject(new Error('no-match')));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests within our scope
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const scopePath = self.location.pathname.replace(/sw\.js$/, '');
  if (!url.pathname.startsWith(scopePath)) return;

  // Navigations: network-first so users get updates on reload; offline falls back to the app shell
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(fromNetwork(request).catch(() => fromCache('./index.html')));
    return;
  }

  if (NETWORK_FIRST.test(url.pathname)) {
    event.respondWith(fromNetwork(request).catch(() => fromCache(request)));
    return;
  }

  // Cache-first for images and other static assets
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => cached || fromNetwork(request))
  );
});
