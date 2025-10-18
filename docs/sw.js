/* FDAT PWA Service Worker */
/* Version bump this to trigger updates */
const SW_VERSION = 'v2';
const PRECACHE = `fdat-precache-${SW_VERSION}`;
const RUNTIME = 'fdat-runtime';

// Core files to cache for offline
const CORE_FILES = [
  './',
  './index.html',
  './textchart/textchart-to-html.xsl',
  './assets/icon-16.png',
  './assets/icon-32.png',
  './assets/icon-48.png',
  './assets/icon-64.png',
  './assets/icon-128.png',
  './assets/icon-256.png',
  './assets/icon-192-maskable.png',
  './assets/icon-512-maskable.png',
  './manifest.webmanifest'
];

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
    }))).then(() => self.clients.claim())
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
    const copy = response.clone();
    caches.open(RUNTIME).then((cache) => cache.put(request, copy));
    return response;
  });
}

function fromCache(request) {
  return caches.match(request).then((cached) => cached || Promise.reject('no-match'));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests within our scope
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-first strategy for navigation (HTML) so users get updates on reload
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(fromNetwork(request).catch(() => fromCache('./index.html')));
    return;
  }

  // Cache-first for same-origin static assets
  if (url.pathname.startsWith(self.location.pathname.replace(/sw\.js$/, ''))) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fromNetwork(request).catch(() => fromCache(request)))
    );
  }
});
