/**
 * IGNITE Push Notification Service Worker
 * * This service worker handles push notifications for the IGNITE app.
 * It receives push events and displays notifications to the user.
 */

// App icon for notifications
const ICON_URL = '/logo.png';
const BADGE_URL = '/logo.png';

// Handle push events
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received:', event);
  
  let data = {
    title: 'IGNITE',
    body: 'Van egy új értesítésed!',
    icon: ICON_URL,
    badge: BADGE_URL,
    tag: 'ignite-notification',
    data: {},
    actions: []
  };
  
  // Parse push data if available
  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || ICON_URL,
        badge: payload.badge || BADGE_URL,
        tag: payload.tag || 'ignite-notification',
        data: payload.data || {},
        actions: payload.actions || [
          { action: 'open', title: 'Megnyitás' },
          { action: 'dismiss', title: 'Bezárás' }
        ]
      };
    } catch (e) {
      // If not JSON, use text
      data.body = event.data.text() || data.body;
    }
  }
  
  // Show notification
  const promiseChain = self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    requireInteraction: true, // Keep it visible until interaction
    actions: data.actions
  });
  
  event.waitUntil(promiseChain);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();
  
  // Handle action buttons
  if (event.action === 'dismiss') {
    return;
  }
  
  // Determine URL based on action or data
  let urlToOpen = '/';
  
  // Specific action handling
  if (event.action === 'record_now') {
    // Direct link to wizard
    urlToOpen = '/wizard?date=' + new Date().toISOString().split('T')[0];
  } else if (event.action === 'view_friends') {
    urlToOpen = '/friends?tab=requests';
  } else if (event.action === 'open_arena') {
    urlToOpen = '/arena';
  } else if (event.notification.data) {
    const data = event.notification.data;
    
    // Fallback based on type if no specific action button was used
    if (data.type === 'friend_request') {
      urlToOpen = '/friends?tab=requests';
    } else if (data.type === 'ping' || data.type === 'fire') {
      urlToOpen = '/arena';
    } else if (data.type === 'streak_warning' || data.type === 'daily_reminder') {
      urlToOpen = '/wizard?date=' + new Date().toISOString().split('T')[0];
    } else if (data.friendId) {
      urlToOpen = `/friend/${data.friendId}`;
    }
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        // If exact match or base match
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Open new window if not open
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed:', event);
  
  // Re-subscribe with the same options
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then((subscription) => {
        console.log('[SW] Re-subscribed:', subscription.endpoint);
        // Best practice: Send new subscription to server here
        // Since we can't easily import the API logic here, 
        // the app will handle it on next launch if we save it to storage or similar logic
      })
      .catch((error) => {
        console.error('[SW] Re-subscription failed:', error);
      })
  );
});

console.log('[SW] IGNITE Push Service Worker loaded v2');
