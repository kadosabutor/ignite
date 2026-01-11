/**
 * IGNITE Push Notification Edge Function
 * Handles user settings checks and sends notifications via Web Push.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

// VAPID keys
const VAPID_PUBLIC_KEY = 'BKzPGSS5yEJp0Fk42IN8sOsAuQweLpNscwDEaIbumFJXUNfeQY7nta1AI49E4CKsmR5gBXZP503O-FuxU7v8fOQ';
// FIGYELEM: Éles környezetben ezt a Deno.env-ből olvasd ki!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '6KYwugwMyKWz3RFBi5JY9NRtNm0BUzgOEyZu8mmkTfA';
const VAPID_SUBJECT = 'mailto:ignite@example.com';

// VAPID beállítása
webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Supabase client config
const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://thibewmulezvjenwowmh.supabase.co';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // CORS kezelés
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // 1. Validáció
    if (!payload.recipientUserId) {
      throw new Error('recipientUserId is required');
    }

    console.log('🚀 Processing push for user:', payload.recipientUserId);

    // Admin kliens inicializálása
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // -----------------------------------------------------------------------
    // 2. LÉPÉS: BEÁLLÍTÁSOK ELLENŐRZÉSE (Settings Check)
    // -----------------------------------------------------------------------
    
    // Lekérjük a címzett beállításait a settings táblából
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('notifications')
      .eq('user_id', payload.recipientUserId)
      .single();

    // Alapértelmezett értékek, ha nincs beállítás (fallback)
    const defaults = {
      enabled: true,
      socialEnabled: true,
      streakEnabled: true,
      morningEnabled: true,
      afternoonEnabled: true,
      eveningEnabled: true
    };

    const userSettings = settingsData?.notifications || defaults;
    const type = payload.data?.type; // pl. 'ping', 'fire', 'friend_request'

    console.log(`Checking settings for type: ${type}`, userSettings);

    // A) Globális kapcsoló ellenőrzése
    if (userSettings.enabled === false) {
      console.log('⛔ Notification skipped: User disabled all notifications.');
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: 'User disabled notifications' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // B) Kategória szintű szűrés
    let isAllowed = true;

    if (type) {
      switch (type) {
        // Közösségi interakciók
        case 'ping':
        case 'fire':
        case 'friend_request':
        case 'friend_accept':
          if (userSettings.socialEnabled === false) isAllowed = false;
          break;
          
        // Streak figyelmeztetések
        case 'streak_warning':
        case 'streak_last':
          if (userSettings.streakEnabled === false) isAllowed = false;
          break;
          
        // Időzített emlékeztetők
        case 'morning':
          if (userSettings.morningEnabled === false) isAllowed = false;
          break;
        case 'afternoon':
          if (userSettings.afternoonEnabled === false) isAllowed = false;
          break;
        case 'evening':
          if (userSettings.eveningEnabled === false) isAllowed = false;
          break;
      }
    }

    if (!isAllowed) {
      console.log(`⛔ Notification skipped: Type '${type}' is disabled by user.`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, message: `Notification type '${type}' disabled` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -----------------------------------------------------------------------
    // 3. LÉPÉS: KÜLDÉS (Sending)
    // -----------------------------------------------------------------------

    // Feliratkozások lekérése
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', payload.recipientUserId);
    
    if (fetchError || !subscriptions || subscriptions.length === 0) {
      console.log('⚠️ No active subscriptions found.');
      return new Response(JSON.stringify({ message: 'No subscriptions' }), { headers: corsHeaders });
    }

    // Payload összeállítása a Service Worker számára
    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/assets/icon-192.png',
      badge: payload.badge || '/assets/icon-192.png',
      tag: payload.tag || 'ignite-notification',
      data: payload.data || {}, // Továbbítjuk a típust és egyéb adatokat
    });

    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions) {
      try {
        const p256dh = sub.p256dh;
        const auth = sub.auth;

        if (!p256dh || !auth) {
          console.error('❌ Missing keys for subscription. Skipping.');
          failCount++;
          continue;
        }

        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: { p256dh, auth }
        };

        // Küldés a web-push könyvtárral
        await webpush.sendNotification(pushSubscription, notificationPayload);
        successCount++;

      } catch (error) {
        console.error(`❌ Failed to send to endpoint ending in ...${sub.endpoint.slice(-10)}`);
        
        // Ha lejárt a feliratkozás (410 Gone vagy 404 Not Found), töröljük
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('🗑️ Subscription expired/invalid. Deleting from DB...');
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
        failCount++;
      }
    }

    // 4. Mentés az in-app értesítések közé (History)
    await supabase.from('notifications').insert({
      user_id: payload.recipientUserId,
      type: type || 'general',
      title: payload.title,
      message: payload.body,
      data: payload.data || {},
      read: false,
      created_at: new Date().toISOString(),
    });

    console.log(`✅ Push cycle complete. Sent: ${successCount}, Failed: ${failCount}`);

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
