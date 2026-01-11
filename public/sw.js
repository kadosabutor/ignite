const CACHE_NAME = 'ignite-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Only cache GET requests - POST, PATCH, PUT, DELETE are not cacheable
  const isGetRequest = event.request.method === 'GET';

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful GET requests
        if (isGetRequest && response.ok) {
          // Clone the response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Only try cache for GET requests
        if (isGetRequest) {
          return caches.match(event.request);
        }
        // For non-GET requests, return a basic error response
        return new Response('Network error', { status: 503 });
      })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const options = {
    body: event.data?.text() || 'Új értesítés az IGNITE-tól!',
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'open', title: 'Megnyitás' },
      { action: 'close', title: 'Bezárás' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('IGNITE', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
