/**
 * IGNITE Push Notification Edge Function - FIXED VERSION
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// VAPID keys
const VAPID_PUBLIC_KEY = 'BKzPGSS5yEJp0Fk42IN8sOsAuQweLpNscwDEaIbumFJXUNfeQY7nta1AI49E4CKsmR5gBXZP503O-FuxU7v8fOQ';
// FIGYELEM: Soha ne hagyd a privát kulcsot a kódban, ha publikálod valahova! De teszteléshez most jó.
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '6KYwugwMyKWz3RFBi5JY9NRtNm0BUzgOEyZu8mmkTfA';
const VAPID_SUBJECT = 'mailto:ignite@example.com'; // Ez kötelező az iOS-hez!

// Beállítjuk a VAPID adatokat
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://thibewmulezvjenwowmh.supabase.co';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const payload = await req.json();
    
    // Validáció...
    if (!payload.recipientUserId) {
      throw new Error('recipientUserId is required');
    }

    console.log('🚀 Start sending push to user:', payload.recipientUserId);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Lekérjük a feliratkozásokat
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', payload.recipientUserId);
    
    if (fetchError || !subscriptions || subscriptions.length === 0) {
      console.log('⚠️ No subscriptions found or error fetching.');
      return new Response(JSON.stringify({ message: 'No subscriptions' }), { headers: corsHeaders });
    }

    // Payload összeállítása
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icon.png', // Fontos: iOS-en nem mindig jelenik meg
      badge: payload.badge || '/icon.png',
      url: payload.url || '/', // Hova vigyen kattintáskor
    });

    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions) {
      try {
        console.log(`📡 Sending to: ...${sub.endpoint.slice(-20)}`);

        // Nem a 'sub.keys'-t keressük, hanem közvetlenül az oszlopokat
        const p256dh = sub.p256dh || (sub.keys && sub.keys.p256dh);
        const auth = sub.auth || (sub.keys && sub.keys.auth);

        if (!p256dh || !auth) {
            console.error('❌ Missing keys (p256dh or auth) for subscription. Skipping.');
            failCount++;
            continue;
        }

        // Összerakjuk a formátumot, amit a web-push kér
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: p256dh,
            auth: auth
          }
        };

        // Küldés
        const result = await webpush.sendNotification(pushSubscription, notificationPayload);
        
        console.log(`✅ SUCCESS! Status: ${result.statusCode}`);
        successCount++;

      } catch (error) {
        console.error(`❌ FAILED to send!`);
        console.error(`   Message: ${error.message}`);
        
        if (error.statusCode === 410 || error.statusCode === 404) {
             console.log('🗑️ Subscription expired. Deleting...');
             await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
        failCount++;
      }
    }

    // Mentés az in-app értesítések közé is
    await supabase.from('notifications').insert({
      user_id: payload.recipientUserId,
      title: payload.title,
      body: payload.body,
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ success: true, sent: successCount, failed: failCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('🔥 CRITICAL ERROR:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
