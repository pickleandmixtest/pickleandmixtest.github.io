/* Pickle&Mix TEST · app-shell cache. Supabase data always remains network-only. */
const CACHE_NAME = 'pickle-mix-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=78',
  './i18n.js?v=14',
  './app.js?v=121',
  './favicon.svg?v=2',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response.ok) await cache.put(path, response);
      } catch (_) {
        // A partial shell is still useful; the next visit can fill missing assets.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('pickle-mix-shell-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch (_) {
        const cached = await caches.match('./index.html') || await caches.match('./');
        return cached || Response.error();
      }
    })());
    return;
  }

  if (APP_SHELL.some(path => new URL(path, self.location.href).href === request.url)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const refresh = fetch(request).then(async response => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      });
      if (cached) {
        event.waitUntil(refresh.catch(() => {}));
        return cached;
      }
      try { return await refresh; } catch (_) { return Response.error(); }
    })());
  }
});
