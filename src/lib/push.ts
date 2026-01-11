/**
 * Push Notification Library for IGNITE
 * 
 * Handles Web Push API subscription and notification management.
 * Works on iOS 16.4+ (when added to Home Screen) and Android.
 */

// VAPID Public Key - Generated for IGNITE
const VAPID_PUBLIC_KEY = 'BKzPGSS5yEJp0Fk42IN8sOsAuQweLpNscwDEaIbumFJXUNfeQY7nta1AI49E4CKsmR5gBXZP503O-FuxU7v8fOQ';

// Supabase Edge Function URL for sending push notifications
const PUSH_API_URL = 'https://thibewmulezvjenwowmh.supabase.co/functions/v1/send-push';

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Check if the app is installed as PWA (required for iOS)
 */
export function isPWAInstalled(): boolean {
  // Check if running in standalone mode (installed PWA)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari specific check
  const isIOSStandalone = (navigator as any).standalone === true;
  return isStandalone || isIOSStandalone;
}

/**
 * Get current notification permission status
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
}

/**
 * Convert VAPID key from base64 to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as BufferSource;
}

/**
 * Subscribe to push notifications
 * Returns the subscription object or null if failed
 */
export async function subscribeToPush(): Promise<any | null> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return null;
  }

  try {
    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('Existing push subscription found');
      return subscription;
    }

    // Create new subscription
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    console.log('New push subscription created:', subscription.endpoint);
    return subscription;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      console.log('Unsubscribed from push notifications');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Error getting subscription:', error);
    return null;
  }
}

/**
 * Send a push notification to a specific user
 * This calls the Supabase Edge Function
 */
export async function sendPushNotification(
  recipientUserId: string,
  title: string,
  body: string,
  data?: Record<string, any>,
  authToken?: string
): Promise<boolean> {
  try {
    const response = await fetch(PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : '',
      },
      body: JSON.stringify({
        recipientUserId,
        title,
        body,
        data,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Push notification failed:', error);
      return false;
    }

    console.log('Push notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

/**
 * Notification types for IGNITE
 */
export type NotificationType =
  | 'ping'           // Friend pinged you
  | 'fire'           // Friend gave you fire
  | 'friend_request' // New friend request
  | 'friend_accept'  // Friend request accepted
  | 'rank_up'        // You ranked up
  | 'rank_down'      // You ranked down
  | 'streak_warning' // Streak about to break
  | 'daily_reminder';// Daily reminder to log

/**
 * Random ping messages
 */
const PING_MESSAGES = [
  "Hé, mikor lesz már bejegyzés? 🔥",
  "Ne aludj el, haver! ⚡",
  "Gyerünk, ma is megcsináljuk! 💪",
  "Ébresztő! Ideje rögzíteni! 🌅",
  "A streak nem tartja magát! 🔥",
  "Egy igazi harcos nem hagy ki napot! ⚔️",
  "Tick-tock... a nap véget ér! ⏰",
  "Mutasd meg, miből vagy! 💥",
];

/**
 * Get a random ping message
 */
export function getRandomPingMessage(): string {
  return PING_MESSAGES[Math.floor(Math.random() * PING_MESSAGES.length)];
}

/**
 * Random fire recognition messages
 */
const FIRE_MESSAGES = [
  "Elismerték a mai teljesítményedet! 🔥",
  "Fantasztikus munka! Tűz vagy! 💪",
  "Valaki elismerésben részesített! 🎉",
  "Tűz elismerés érkezett! Te vagy a hős! ⚔️",
  "Elismerésben részesítettek! Csillogsz! ✨",
  "Valaki tüzet adott neked! Fantasztikus! 🔥",
  "Elismerés érkezett! Folytasd így! 💥",
  "Tűz elismerés! Te vagy a legjobb! 🏆",
];

/**
 * Get a random fire message
 */
export function getRandomFireMessage(): string {
  return FIRE_MESSAGES[Math.floor(Math.random() * FIRE_MESSAGES.length)];
}

/**
 * Format notification for different types
 */
export function formatNotification(
  type: NotificationType,
  senderName?: string,
  data?: Record<string, any>
): { title: string; body: string } {
  switch (type) {
    case 'ping':
      return {
        title: `${senderName || 'Valaki'} pingelt! 🔔`,
        body: getRandomPingMessage(),
      };

    case 'fire':
      return {
        title: `${senderName || 'Valaki'} tüzet adott! 🔥`,
        body: 'Elismerték a mai teljesítményedet!',
      };

    case 'friend_request':
      return {
        title: 'Új barátkérelem! 👋',
        body: `${senderName || 'Valaki'} szeretne a barátod lenni.`,
      };

    case 'friend_accept':
      return {
        title: 'Barátkérelem elfogadva! 🎉',
        body: `${senderName || 'Valaki'} elfogadta a barátkérelmedet.`,
      };

    case 'rank_up':
      return {
        title: 'Ranglétra emelkedés! 🚀',
        body: `Gratulálunk! Új rangod: ${data?.rank || 'Ismeretlen'}`,
      };

    case 'rank_down':
      return {
        title: 'Rang csökkenés 📉',
        body: 'Dolgozz keményebben, hogy visszaszerezd a rangod!',
      };

    case 'streak_warning':
      return {
        title: 'Streak veszélyben! ⚠️',
        body: 'Még nem rögzítetted a mai napot. Ne hagyd kialudni a tüzet!',
      };

    case 'daily_reminder':
      return {
        title: 'Napi emlékeztető 📝',
        body: 'Ideje rögzíteni a mai napodat!',
      };

    default:
      return {
        title: 'IGNITE értesítés',
        body: 'Van egy új értesítésed.',
      };
  }
}
