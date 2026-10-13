const CACHE = 'doughflow-v61-20261013-admin-content-media';

const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './styles.css',
  './dashboard.css',
  './mobile.css',
  './interactive.css',
  './i18n.js',
  './manifest.webmanifest',
  './icon.svg',
  './assets/bakery.webp',
  './assets/leposhka-detail.svg',
  './assets/leposhka-delivery.svg',
  './assets/leposhka-emblem.svg',
  './assets/doughflow-gallery/01-baker-tandoor-hd-20261012.webp',
  './assets/doughflow-gallery/02-leposhka-closeup-hd-20261012.avif',
  './assets/doughflow-gallery/03-bishkek-context.webp',
  './assets/doughflow-gallery/04-bread-delivery-owner.webp',
  './assets/doughflow-gallery/05-bread-delivery-worker.webp',
  './assets/doughflow-gallery/06-van-bread-stock.webp',
  './assets/doughflow-gallery/07-bakery-team.webp',
  './assets/doughflow-gallery/08-bakery-team-selfie.webp',
  './assets/doughflow-gallery/09-team-social.webp',
  './assets/doughflow-gallery/10-oven-production.webp',
];

const NETWORK_FIRST = new Set([
  '/app.js',
  '/styles.css',
  '/dashboard.css',
  '/mobile.css',
  '/interactive.css',
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
