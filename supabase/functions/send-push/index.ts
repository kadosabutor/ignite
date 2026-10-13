/**
 * IGNITE Push Notification Edge Function
 *
 * Hívók:
 *  - cron-scheduler (service role kulccsal) → bárkinek küldhet
 *  - bejelentkezett felhasználó (saját JWT) → csak olyannak, akivel van
 *    barátsági kapcsolata (függő vagy elfogadott), és nem saját magának
 *
 * Szükséges secretek: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (opcionális: VAPID_SUBJECT)
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:ignite@example.com';

const MAX_TITLE = 80;
const MAX_BODY = 300;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('VAPID secrets are not configured');
    return json({ error: 'Push not configured' }, 503);
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const admin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // --- Hitelesítés ---
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Unauthorized' }, 401);

    const isService = token === supabaseServiceKey;
    let senderId: string | null = null;

    if (!isService) {
      const { data: { user }, error } = await admin.auth.getUser(token);
      if (error || !user) return json({ error: 'Unauthorized' }, 401);
      senderId = user.id;
    }

    const payload = await req.json();
    const recipientUserId: string | undefined = payload.recipientUserId;
    if (!recipientUserId || typeof recipientUserId !== 'string') {
      return json({ error: 'recipientUserId is required' }, 400);
    }

    // --- Jogosultság: felhasználó csak kapcsolatban álló félnek küldhet ---
    if (senderId) {
      if (senderId === recipientUserId) return json({ error: 'Forbidden' }, 403);

      const { data: link } = await admin
        .from('friendships')
        .select('id')
        .or(
          `and(user_id.eq.${senderId},friend_id.eq.${recipientUserId}),and(user_id.eq.${recipientUserId},friend_id.eq.${senderId})`
        )
        .limit(1);

      if (!link || link.length === 0) return json({ error: 'Forbidden' }, 403);
    }

    const title = String(payload.title ?? '').slice(0, MAX_TITLE);
    const body = String(payload.body ?? '').slice(0, MAX_BODY);
    const type = String(payload.data?.type ?? 'general').slice(0, 40);

    // In-app értesítés mentése (a push sikerétől függetlenül)
    await admin.from('notifications').insert({
      user_id: recipientUserId,
      type,
      title,
      message: body,
      data: { ...(payload.data ?? {}), senderId: senderId ?? undefined },
    });

    const { data: subscriptions, error: fetchError } = await admin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', recipientUserId);

    if (fetchError || !subscriptions || subscriptions.length === 0) {
      return json({ success: true, sent: 0, failed: 0, message: 'No subscriptions' });
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: '/assets/icon-192.png',
      badge: '/assets/icon-192.png',
      url: '/',
      data: { type },
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      if (!sub.p256dh || !sub.auth) {
        failed++;
        continue;
      }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          notificationPayload
        );
        sent++;
      } catch (error) {
        failed++;
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: lejárt; 401/403: más VAPID kulccsal készült feliratkozás
        if (status === 404 || status === 410 || status === 401 || status === 403) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        } else {
          console.error('Push failed:', status, (error as Error).message);
        }
      }
    }

    return json({ success: true, sent, failed });
  } catch (error) {
    console.error('send-push error:', (error as Error).message);
    return json({ error: 'Internal error' }, 500);
  }
});
