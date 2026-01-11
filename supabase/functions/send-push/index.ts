/**
 * IGNITE Push Notification Edge Function
 * * This Supabase Edge Function sends push notifications to users.
 * It uses the Web Push protocol with VAPID authentication.
 */

import { createClient } from '@supabase/supabase-js';

// VAPID keys for Web Push
const VAPID_PUBLIC_KEY = 'BKzPGSS5yEJp0Fk42IN8sOsAuQweLpNscwDEaIbumFJXUNfeQY7nta1AI49E4CKsmR5gBXZP503O-FuxU7v8fOQ';
// Note: In production, keep private keys in environment variables
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '6KYwugwMyKWz3RFBi5JY9NRtNm0BUzgOEyZu8mmkTfA';
const VAPID_SUBJECT = 'mailto:ignite@example.com';

// Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://thibewmulezvjenwowmh.supabase.co';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  recipientUserId: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>; // data.type contains the category (ping, morning, etc.)
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface NotificationSettings {
  enabled: boolean;
  morningEnabled: boolean;
  afternoonEnabled: boolean;
  eveningEnabled: boolean;
  streakEnabled: boolean;
  socialEnabled: boolean;
}

/**
 * Helper to determine actions based on notification type
 */
function getActionsForType(type: string): Array<{ action: string; title: string }> {
  switch (type) {
    case 'ping':
    case 'streak_warning':
    case 'daily_reminder':
    case 'morning':
    case 'afternoon':
    case 'evening':
      return [
        { action: 'record_now', title: '🔥 Rögzítés most' },
        { action: 'dismiss', title: 'Később' }
      ];
    case 'friend_request':
      return [
        { action: 'view_friends', title: '👀 Megtekintés' },
        { action: 'dismiss', title: 'Bezárás' }
      ];
    case 'fire':
      return [
        { action: 'open_arena', title: '⚔️ Irány az Aréna' },
        { action: 'dismiss', title: 'Király!' }
      ];
    default:
      return [
        { action: 'open', title: 'Megnyitás' },
        { action: 'dismiss', title: 'Bezárás' }
      ];
  }
}

/**
 * Convert base64url to Uint8Array
 */
function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - base64Url.length % 4) % 4);
  const base64 = (base64Url + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Extract and verify JWT token from Authorization header
 */
async function verifyJWT(req: Request): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    console.log('No authorization header');
    return null;
  }

  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    console.log('No token in authorization header');
    return null;
  }

  try {
    // Create Supabase client with anon key to verify JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Verify the token by getting the user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('JWT verification failed:', error);
      return null;
    }

    return { userId: user.id };
  } catch (error) {
    console.error('Error verifying JWT:', error);
    return null;
  }
}

/**
 * Send a Web Push notification
 */
async function sendWebPush(
  subscription: PushSubscription,
  payload: string
): Promise<Response> {
  // Import web-push compatible library for Deno if available in production
  // For now, using direct fetch to FCM/endpoint
  
  const endpoint = subscription.endpoint;

  // Ensure payload is string
  const bodyPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);

  try {
    // Note: In a real production environment with VAPID, you need to sign the headers.
    // This fetch implementation assumes the endpoint might handle unsigned requests or 
    // is a simplified representation. For full VAPID support in Deno, 
    // a library like 'web-push' is recommended.
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400', // 24 hours
      },
      body: bodyPayload,
    });

    return response;
  } catch (error) {
    console.error('Error sending push:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Check if debug mode is enabled
  const url = new URL(req.url);
  const debugMode = url.searchParams.get('debug') === 'true';

  try {
    // Verify JWT token
    const authResult = await verifyJWT(req);

    if (!authResult) {
      console.log('JWT verification failed');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const payload: PushPayload = await req.json();

    if (!payload.recipientUserId) {
      return new Response(
        JSON.stringify({ error: 'recipientUserId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. CHECK USER SETTINGS (SERVER-SIDE FILTERING)
    const { data: settingsRecord, error: settingsError } = await supabase
      .from('settings')
      .select('notifications')
      .eq('user_id', payload.recipientUserId)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Error fetching settings:', settingsError);
    }

    const settings = (settingsRecord?.notifications || {
      enabled: true,
      morningEnabled: true,
      afternoonEnabled: true,
      eveningEnabled: true,
      streakEnabled: true,
      socialEnabled: true
    }) as NotificationSettings;

    // Master switch
    if (!settings.enabled) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'User has disabled notifications' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Category filtering
    const type = payload.data?.type || 'general';
    let shouldSend = true;

    switch (type) {
      case 'ping':
      case 'fire':
      case 'friend_request':
      case 'friend_accept':
        if (!settings.socialEnabled) shouldSend = false;
        break;
      case 'streak_warning':
      case 'streak_last':
        if (!settings.streakEnabled) shouldSend = false;
        break;
      case 'morning':
        if (!settings.morningEnabled) shouldSend = false;
        break;
      case 'afternoon':
        if (!settings.afternoonEnabled) shouldSend = false;
        break;
      case 'evening':
        if (!settings.eveningEnabled) shouldSend = false;
        break;
    }

    if (!shouldSend) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: `Notification type '${type}' is disabled by user` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. FETCH SUBSCRIPTIONS
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', payload.recipientUserId);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No push subscriptions found for user', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. PREPARE PAYLOAD WITH ACTIONS
    const actions = getActionsForType(type);
    
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/logo.png',
      badge: payload.badge || '/logo.png',
      tag: payload.tag || `ignite-${type}`,
      data: {
        ...(payload.data || {}),
        type, // Ensure type is present in data
        url: type === 'ping' || type === 'streak_warning' ? '/wizard' : '/'
      },
      actions: actions
    });

    // 4. SEND TO ALL SUBSCRIPTIONS
    let successCount = 0;
    let failCount = 0;
    const results: any[] = [];

    for (const sub of subscriptions) {
      try {
        const subscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const response = await sendWebPush(subscription, notificationPayload);
        const responseBody = await response.text();
        
        results.push({
          endpoint: subscription.endpoint,
          status: response.status,
          success: response.ok
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
          // Remove invalid subscriptions (410 Gone or 404 Not Found)
          if (response.status === 410 || response.status === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      } catch (error: any) {
        failCount++;
        console.error('Error processing subscription:', error);
      }
    }

    // 5. SAVE TO NOTIFICATIONS TABLE (IN-APP HISTORY)
    await supabase.from('notifications').insert({
      user_id: payload.recipientUserId,
      title: payload.title,
      body: payload.body,
      type: type,
      data: payload.data || {},
      read: false,
      created_at: new Date().toISOString(),
    });

    const responseData: any = {
      success: true,
      sent: successCount,
      failed: failCount,
      message: 'Notifications processed with filtering',
    };

    if (debugMode) {
      responseData.results = results;
    }

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-push function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
