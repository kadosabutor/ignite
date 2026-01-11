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
  console.log('[SW] Push event received:', event);

  let notificationData = {
    title: 'IGNITE',
    body: 'Új értesítés az IGNITE-tól!',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'ignite-notification',
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: payload.badge || notificationData.badge,
        tag: payload.tag || notificationData.tag,
        data: payload.data || notificationData.data,
      };
    } catch (e) {
      // If not JSON, try text
      try {
        const text = event.data.text();
        if (text) {
          notificationData.body = text;
        }
      } catch (textError) {
        console.error('[SW] Error parsing push data:', textError);
      }
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    vibrate: [100, 50, 100],
    data: notificationData.data,
    actions: [
      { action: 'open', title: 'Megnyitás' },
      { action: 'close', title: 'Bezárás' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  // Handle dismiss action
  if (event.action === 'close' || event.action === 'dismiss') {
    return;
  }

  // Get the URL to open based on notification data
  let urlToOpen = '/';

  if (event.notification.data) {
    const data = event.notification.data;

    // Navigate based on notification type
    if (data.type === 'friend_request') {
      urlToOpen = '/profile?tab=friends';
    } else if (data.type === 'ping' || data.type === 'fire') {
      urlToOpen = '/arena';
    } else if (data.friendId) {
      urlToOpen = `/friend/${data.friendId}`;
    }
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
