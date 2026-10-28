const CACHE_PREFIX = 'local-deals-hub-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      ),
      self.clients.claim(),
    ])
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    const data = event.data ? event.data.json() : {};
    payload = data && typeof data === 'object' ? data : {};
  } catch {
    payload = { body: event.data?.text() || 'A new local deal is available.' };
  }

  const title = typeof payload.title === 'string' ? payload.title : 'Local Deals Hub';
  const body = typeof payload.body === 'string' ? payload.body : 'A new local deal is available.';
  const icon = typeof payload.icon === 'string' ? payload.icon : '/icon-192.png';
  let targetUrl = new URL('/', self.location.origin).href;
  if (typeof payload.url === 'string') {
    try {
      const candidate = new URL(payload.url, self.location.origin);
      if (candidate.origin === self.location.origin) targetUrl = candidate.href;
    } catch (error) {
      console.warn('Ignoring invalid push notification URL:', error);
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: '/icon-192.png',
      data: { url: targetUrl },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  let targetUrl = new URL('/', self.location.origin);
  try {
    if (typeof event.notification.data?.url === 'string') {
      const candidate = new URL(event.notification.data.url, self.location.origin);
      if (candidate.origin === self.location.origin) targetUrl = candidate;
    }
  } catch (error) {
    console.warn('Ignoring invalid notification click URL:', error);
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existingClient = clients.find(
          (client) => new URL(client.url).origin === self.location.origin
        );
        if (existingClient) {
          return existingClient.navigate(targetUrl.href).then((client) => client?.focus());
        }
        return self.clients.openWindow(targetUrl.href);
      })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const responseToCache = response.clone();
          void caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(async () => (await caches.match(event.request)) || Response.error())
  );
});
