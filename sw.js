/* Pickle&Mix TEST · app-shell cache. Supabase data always remains network-only. */
const CACHE_NAME = 'pickle-mix-shell-v6';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=80',
  './i18n.js?v=14',
  './app.js?v=125',
  './favicon.svg?v=2',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Install only when the complete shell is available; an incomplete update
    // must not replace a previously working offline cache.
    await cache.addAll(APP_SHELL);
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
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        const cached = await caches.match(request);
        return cached || Response.error();
      }
    })());
  }
});
