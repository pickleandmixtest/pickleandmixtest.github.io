/* Pickle&Mix TEST · app-shell cache. Supabase data always remains network-only. */
const CACHE_NAME = 'pickle-mix-shell-v51';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=94',
  './i18n.js?v=17',
  './app.js?v=160',
  './manifest.webmanifest',
  './favicon.svg',
  './icons/pickle-mix-192.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
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

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title || 'Pickle&Mix', {
    body: data.body || 'Tienes una novedad en Pickle&Mix.',
    icon: './icons/pickle-mix-192.jpg',
    badge: './icons/pickle-mix-192.jpg',
    tag: data.tag || 'pickle-mix-notification',
    data: { url: data.url || './' },
    renotify: false
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.origin).href;
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
