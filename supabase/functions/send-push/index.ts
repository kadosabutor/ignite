/**
 * IGNITE Push Notification Edge Function
 * 
 * This Supabase Edge Function sends push notifications to users.
 * It uses the Web Push protocol with VAPID authentication.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ApplicationServer } from 'jsr:@negrel/webpush@^0.1.0';

// VAPID keys for Web Push
const VAPID_PUBLIC_KEY = 'BKzPGSS5yEJp0Fk42IN8sOsAuQweLpNscwDEaIbumFJXUNfeQY7nta1AI49E4CKsmR5gBXZP503O-FuxU7v8fOQ';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '6KYwugwMyKWz3RFBi5JY9NRtNm0BUzgOEyZu8mmkTfA';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:ignite@example.com';

// Initialize ApplicationServer for sending push notifications
let appServer: ApplicationServer | null = null;

async function getApplicationServer(): Promise<ApplicationServer> {
  if (!appServer) {
    appServer = await ApplicationServer.new({
      contactInformation: VAPID_SUBJECT,
      vapidKeys: {
        publicKey: VAPID_PUBLIC_KEY,
        privateKey: VAPID_PRIVATE_KEY,
      },
    });
  }
  return appServer;
}

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
  data?: Record<string, any>;
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
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
 * Send a Web Push notification using VAPID
 */
async function sendWebPush(
  subscription: PushSubscription,
  payload: string
): Promise<void> {
  try {
    const server = await getApplicationServer();
    
    // Convert base64url keys to Uint8Array
    const p256dh = base64UrlToUint8Array(subscription.keys.p256dh);
    const auth = base64UrlToUint8Array(subscription.keys.auth);
    
    // Create subscription object with proper key format
    const pushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: p256dh,
        auth: auth,
      },
    };
    
    // Send the notification
    await server.sendNotification(pushSubscription, payload);
    
    console.log('Push notification sent successfully to:', subscription.endpoint);
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
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
    
    console.log('JWT verified for user:', authResult.userId);
    
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
    
    // Get recipient's push subscription from database
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', payload.recipientUserId);
    
    if (fetchError) {
      console.error('Error fetching subscriptions:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscriptions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log('No push subscriptions found for user:', payload.recipientUserId);
      return new Response(
        JSON.stringify({ error: 'No push subscriptions found for user', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Prepare notification payload
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/logo.png',
      badge: payload.badge || '/logo.png',
      tag: payload.tag || 'ignite-notification',
      data: payload.data || {},
    });
    
    // Send to all subscriptions
    let successCount = 0;
    let failCount = 0;
    
    for (const sub of subscriptions) {
      try {
        const subscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };
        
        console.log('Sending push to:', subscription.endpoint);
        
        // Send the actual push notification
        await sendWebPush(subscription, notificationPayload);
        
        successCount++;
      } catch (error: any) {
        console.error('Error sending to subscription:', error);
        failCount++;
        
        // If subscription is invalid (410 Gone), remove it from database
        const statusCode = error?.statusCode || error?.status || error?.response?.status;
        if (statusCode === 410 || statusCode === 404) {
          console.log('Removing invalid subscription:', sub.id);
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
        }
      }
    }
    
    // Also save notification to database for in-app display
    await supabase.from('notifications').insert({
      user_id: payload.recipientUserId,
      title: payload.title,
      body: payload.body,
      type: payload.data?.type || 'general',
      data: payload.data || {},
      read: false,
      created_at: new Date().toISOString(),
    });
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        sent: successCount, 
        failed: failCount,
        message: 'Notifications queued'
      }),
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
