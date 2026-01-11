/**
 * Push Notification Library for IGNITE
 * * Handles Web Push API subscription and notification management.
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
 * Send a push notification to a specific user
 * This calls the Supabase Edge Function
 */
export async function sendPushNotification(
  recipientUserId: string,
  title: string,
  body: string,
  type: string = 'general',
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
        data: { type, ...data }, // Include type in data payload
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

// ==========================================
// 🔔 ÉRTESÍTÉSI SABLONOK (TEMPLATES)
// ==========================================

export type NotificationType =
  | 'ping'           // Friend pinged you
  | 'fire'           // Friend gave you fire
  | 'friend_request' // New friend request
  | 'friend_accept'  // Friend request accepted
  | 'rank_up'        // You ranked up
  | 'rank_down'      // You ranked down
  | 'streak_warning' // Streak about to break
  | 'streak_last'    // Last chance warning
  | 'morning'        // Daily morning motivation
  | 'afternoon'      // Afternoon check-in
  | 'evening'        // Evening reminder
  | 'daily_reminder';// Generic daily reminder

interface MessageTemplate {
  title: string;
  body: string;
}

const NOTIFICATION_TEMPLATES: Record<NotificationType, MessageTemplate[]> = {
  // --- REGGEL (07:00) ---
  morning: [
    { title: "Jó reggelt, Harcos! 🌅", body: "Róma sem egy nap alatt épült, de minden nap raktak le téglát. Kezdjük a napot!" },
    { title: "Wakey wakey! ⚡", body: "Main character energy only today. Mutasd meg, mit tudsz!" },
    { title: "Napindító 🔥", body: "Új nap, új lehetőség a dominanciára. Ne hagyd ki!" },
    { title: "Ébresztő! ⚔️", body: "A történelem a győztesekre emlékszik. Légy ma te a győztes!" },
    { title: "Rise and Grind 💪", body: "A lustaság az ellenség. Győzd le már reggel!" },
  ],

  // --- DÉLUTÁN (15:00) ---
  afternoon: [
    { title: "Délutáni Check-in 📍", body: "Hogy állsz a célokkal? Hannibál sem állt meg az Alpok felénél." },
    { title: "Ne aludj be! ☕", body: "Délutáni slump? Nem hiszem. Let's get this bread!" },
    { title: "Félúton vagyunk! 🚀", body: "Nyomd meg a nap második felét! A dicsőség vár." },
    { title: "Fókusz! 🎯", body: "Ne hagyd, hogy a figyelemelterelés győzzön. Maradj a pályán!" },
  ],

  // --- ESTE (21:00) ---
  evening: [
    { title: "Napzárás 🌙", body: "A nap lenyugodott. Itt az ideje az elszámolásnak. Rögzíts!" },
    { title: "Last call, fam! ⏳", body: "Zárjuk a napot, no cap. Rögzítsd az eredményeidet!" },
    { title: "Nagy Sándor is pihent... ⚔️", body: "...de előtte rögzítette a hódításait. Te se felejtsd el!" },
    { title: "Esti emlékeztető 📝", body: "Ne feküdj le anélkül, hogy értékelted volna a mai teljesítményedet." },
  ],

  // --- STREAK WARNING (Ha veszélyben a sorozat) ---
  streak_warning: [
    { title: "Veszélyzóna! ⚠️", body: "A sorozatod veszélyben van! Ne hagyd kialudni a tüzet!" },
    { title: "Bro, a streak-ed RIP lesz! 💀", body: "Ne légy NPC. Lépj be és mentsd meg a sorozatot!" },
    { title: "Védd a Birodalmat! 🛡️", body: "A lángod pislákol. Tegyél rá fát, mielőtt késő lenne!" },
    { title: "Ne törd meg a láncot! ⛓️", body: "Túl sokat dolgoztál érte. Ne hagyd veszni!" },
  ],

  streak_last: [
    { title: "🚨 UTOLSÓ ESÉLY! 🚨", body: "1 órád maradt megmenteni a streaket! FUTÁS!" },
    { title: "CODE RED 🔥", body: "Azonnal rögzíts, vagy mindennek vége! Nem viccelünk." },
  ],

  // --- PING (Barátoktól) ---
  ping: [
    { title: "{name} pingelt! 🔔", body: "Hé, mikor lesz már bejegyzés? 🔥" },
    { title: "{name} üzeni: ⚔️", body: "Egy igazi harcos nem hagy ki napot! Hol vagy?" },
    { title: "{name} ghostingolva érzi magát 👻", body: "Ne hagyd lógva a haverodat. Rögzíts!" },
    { title: "{name} hív! 📞", body: "Ébresztő! A streak nem tartja magát!" },
    { title: "{name} rázza a kerítést! 🚧", body: "WYA? (Where You At?) Gyere már!" },
  ],

  // --- FIRE (Elismerés) ---
  fire: [
    { title: "{name} tüzet adott! 🔥", body: "Sheeesh! Ez nagyon adja! Csak így tovább!" },
    { title: "{name} elismerte a napodat! 🤝", body: "Tisztelet a harcosnak. Szép munka volt!" },
    { title: "Bumm! 💥 {name} küldött egy tüzet!", body: "Látják a kemény munkádat. Büszke lehetsz!" },
    { title: "{name}: Ez igen! 🏆", body: "Király vagy! A ranglétra csúcsa vár." },
  ],

  // --- SOCIAL (Egyéb) ---
  friend_request: [
    { title: "👋 Új Barátkérelem!", body: "{name} szeretne a szövetségesed lenni." },
    { title: "Új bestie alert! 👯", body: "{name} bejelölt. Csekkold le a profilt!" },
    { title: "Kihívó érkezett! ⚔️", body: "{name} barátnak jelölt. Fogadd el és küzdjetek meg!" },
  ],

  friend_accept: [
    { title: "✅ Kérelem Elfogadva!", body: "{name} mostantól a köröd része." },
    { title: "A Szövetség megköttetett! 🤝", body: "{name} elfogadta a jelölésedet." },
    { title: "Let's gooo! 🚀", body: "{name} visszajelölt. Indulhat a verseny!" },
  ],

  // --- RANK (Ranglépés) ---
  rank_up: [
    { title: "LEVEL UP! 🚀", body: "Gratulálunk! Új rangod: {rank}. Ez igen, King/Queen!" },
    { title: "Előléptetés! ⭐", body: "Kemény munkád gyümölcse beérett. Üdv a {rank} szinten!" },
    { title: "Új Rang: {rank} 🏆", body: "A legendák közé emelkedtél. Csak így tovább!" },
  ],

  rank_down: [
    { title: "Rang Csökkenés 📉", body: "Vigyázz! Visszaestél. Kapd össze magad és szerezd vissza!" },
    { title: "Ember a vízben! 🌊", body: "elvesztetted a rangodat. Dolgozz keményebben!" },
  ],

  daily_reminder: [
    { title: "Napi emlékeztető 📝", body: "Ideje rögzíteni a mai napodat!" },
  ]
};

/**
 * Get a random message from template
 */
function getRandomTemplate(type: NotificationType): MessageTemplate {
  const templates = NOTIFICATION_TEMPLATES[type] || NOTIFICATION_TEMPLATES.daily_reminder;
  return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Format notification and replace placeholders
 */
export function formatNotification(
  type: NotificationType,
  senderName?: string,
  data?: Record<string, any>
): { title: string; body: string } {
  
  const template = getRandomTemplate(type);
  let title = template.title;
  let body = template.body;

  // Replace placeholders
  const name = senderName || 'Valaki';
  const rank = data?.rank || 'Ismeretlen';

  title = title.replace('{name}', name).replace('{rank}', rank);
  body = body.replace('{name}', name).replace('{rank}', rank);

  return { title, body };
}

// Export simple getters for random messages (used in Arena.tsx manually)
export function getRandomPingMessage(): string {
  return getRandomTemplate('ping').title.replace('{name} ', ''); // Return just the punchline for manual sending
}

export function getRandomFireMessage(): string {
  return getRandomTemplate('fire').body.replace('{name}', 'Valaki');
}
