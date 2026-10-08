const CACHE = 'doughflow-v3-20261008';

const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './i18n.js',
  './manifest.webmanifest',
  './icon.svg'
];

const NETWORK_FIRST = new Set([
  '/app.js',
  '/styles.css',
  '/i18n.js',
  '/config.js'
]);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Always refresh app shell/navigation so a deployment never leaves the phone on an old UI.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, {cache:'no-store'})
        .then(response => {
          const clone=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./index.html',clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  if (NETWORK_FIRST.has(url.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
